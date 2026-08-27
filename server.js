require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const notifier = require("node-notifier");
const { parseMessage } = require("./shared/parser");
const { findMatches } = require("./shared/matcher");
const {
  createRemoteFilter,
  deleteRemoteFilter,
  fetchRemoteFilters,
  pushMessage,
  seedRemoteFilters,
  updateRemoteFilter,
} = require("./supabase-client");

const PORT = process.env.PORT || 4173;
const DATA_DIR = path.join(__dirname, "data");
const FILTERS_FILE = path.join(DATA_DIR, "filters.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(FILTERS_FILE)) fs.writeFileSync(FILTERS_FILE, "[]");

function loadFilters() {
  try {
    return JSON.parse(fs.readFileSync(FILTERS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveFilters(filters) {
  fs.writeFileSync(FILTERS_FILE, JSON.stringify(filters, null, 2));
}

// In-memory recent activity log for the UI's live feed (not persisted —
// it's just a rolling window, not a system of record).
const MAX_LOG = 200;
const recentLog = [];

function pushLog(entry) {
  recentLog.unshift(entry);
  if (recentLog.length > MAX_LOG) recentLog.length = MAX_LOG;
}

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---- Filters CRUD ----

app.get("/api/filters", async (req, res) => {
  try {
    res.json((await fetchRemoteFilters()) || loadFilters());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/filters", async (req, res) => {
  const filters = loadFilters();
  const { pickup = "", drop = "", vehicle = "", label = "" } = req.body || {};
  const newFilter = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    label: label || [pickup || "Anywhere", drop || "Anywhere"].join(" → "),
    pickup: pickup.trim(),
    drop: drop.trim(),
    vehicle: vehicle.trim(),
    enabled: true,
    createdAt: new Date().toISOString(),
  };
  try {
    const remote = await createRemoteFilter(newFilter);
    if (remote) return res.json(remote);
    filters.push(newFilter);
    saveFilters(filters);
    res.json(newFilter);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/filters/:id", async (req, res) => {
  const filters = loadFilters();
  const idx = filters.findIndex((f) => f.id === req.params.id);
  const { pickup, drop, vehicle, label, enabled } = req.body || {};
  const changes = {};
  if (pickup !== undefined) changes.pickup = pickup.trim();
  if (drop !== undefined) changes.drop = drop.trim();
  if (vehicle !== undefined) changes.vehicle = vehicle.trim();
  if (label !== undefined) changes.label = label;
  if (enabled !== undefined) changes.enabled = !!enabled;

  try {
    const remote = await updateRemoteFilter(req.params.id, changes);
    if (remote) return res.json(remote);
    if (idx === -1) return res.status(404).json({ error: "not found" });
    Object.assign(filters[idx], changes);
    saveFilters(filters);
    res.json(filters[idx]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/filters/:id", async (req, res) => {
  const filters = loadFilters().filter((f) => f.id !== req.params.id);
  try {
    const remote = await deleteRemoteFilter(req.params.id);
    if (remote) return res.json({ ok: true });
    saveFilters(filters);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---- Ingest (source-agnostic: notification listener today, Baileys later) ----

app.post("/api/ingest", async (req, res) => {
  const { text, source = "unknown", groupName = "" } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: "text required" });

  const parsed = parseMessage(text);
  const filters = (await fetchRemoteFilters()) || loadFilters();
  const matched = findMatches(parsed, filters);

  const logEntry = {
    at: new Date().toISOString(),
    source,
    groupName,
    text,
    parsed,
    matchedFilterIds: matched.map((m) => m.id),
  };
  pushLog(logEntry);

  if (matched.length > 0) {
    const labels = matched.map((m) => m.label).join(", ");
    notifier.notify({
      title: `Trip match: ${labels}`,
      message: [
        parsed.pickup && `From: ${parsed.pickup}`,
        parsed.drop && `To: ${parsed.drop}`,
        parsed.vehicle && `Vehicle: ${parsed.vehicle}`,
        parsed.price && `Price: ${parsed.price}`,
        parsed.contact && `Contact: ${parsed.contact}`,
      ]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 250),
      // Windows toast looping "call" sound (trilling ringtone), instead
      // of the default notification ding — stands out more for something
      // you want to react to quickly.
      sound: "Notification.Looping.Call",
      wait: false,
    });
  }

  res.json({ matched: matched.length, matches: matched.map((m) => m.id) });

  // Push to Supabase after responding — this is "fire and forget" so a
  // slow/unreachable Supabase never delays your local notification.
  pushMessage({ source, groupName, rawText: text, parsed, matched }).catch(() => {});
});

// ---- Live feed for the UI ----

app.get("/api/log", (req, res) => {
  res.json(recentLog);
});

app.listen(PORT, () => {
  console.log(`Trip monitor running at http://localhost:${PORT}`);
  seedRemoteFilters(loadFilters()).catch((error) => {
    console.log("[supabase] filter seed error:", error.message);
  });
});
