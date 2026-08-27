// Pushes every ingested message to Supabase (for the phone app + future
// analytics). This uses the SERVICE ROLE key, which bypasses row-level
// security — that's intentional and safe here because this file only
// ever runs on your local machine, never in a browser. The phone app
// uses a separate, much more restricted ANON key (see mobile-pwa/).
//
// If Supabase isn't configured (no .env yet), this quietly does nothing
// — the local notification system keeps working standalone either way.

let client = null;
let warnedOnce = false;
const { sendMatchedPush } = require("./fcm-client");

function getClient() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceKey) {
    if (!warnedOnce) {
      console.log(
        "[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in .env — " +
        "skipping cloud sync. The local app still works normally. " +
        "See supabase/README.md to set this up."
      );
      warnedOnce = true;
    }
    return null;
  }

  if (serviceKey.startsWith("sb_publishable_")) {
    console.log(
      "[supabase] The server is using a publishable/anon key. Replace it with " +
        "a secret key (sb_secret_...) or legacy service_role key in .env."
    );
    warnedOnce = true;
    return null;
  }

  const { createClient } = require("@supabase/supabase-js");
  client = createClient(url, serviceKey, { auth: { persistSession: false } });
  return client;
}

async function fetchRemoteFilters() {
  const supabase = getClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("trip_filters")
    .select("id,label,pickup,drop_location,vehicle,enabled,created_at")
    .order("created_at", { ascending: true });
  if (error) {
    console.log("[supabase] filter load failed:", error.message);
    return null;
  }
  return data.map((filter) => ({
    ...filter,
    drop: filter.drop_location,
    createdAt: filter.created_at,
  }));
}

async function seedRemoteFilters(filters) {
  const supabase = getClient();
  if (!supabase || filters.length === 0) return;

  const remoteFilters = await fetchRemoteFilters();
  if (remoteFilters === null || remoteFilters.length > 0) return;

  const { error } = await supabase.from("trip_filters").insert(
    filters.map((filter) => ({
      label: filter.label,
      pickup: filter.pickup || "",
      drop_location: filter.drop || "",
      vehicle: filter.vehicle || "",
      enabled: filter.enabled !== false,
    }))
  );
  if (error) console.log("[supabase] filter seed failed:", error.message);
}

async function createRemoteFilter(filter) {
  const supabase = getClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("trip_filters")
    .insert({
      label: filter.label,
      pickup: filter.pickup || "",
      drop_location: filter.drop || "",
      vehicle: filter.vehicle || "",
      enabled: filter.enabled !== false,
    })
    .select()
    .single();
  if (error) throw error;
  return { ...data, drop: data.drop_location, createdAt: data.created_at };
}

async function updateRemoteFilter(id, changes) {
  const supabase = getClient();
  if (!supabase) return null;
  const update = { ...changes };
  if (update.drop !== undefined) {
    update.drop_location = update.drop;
    delete update.drop;
  }
  const { data, error } = await supabase
    .from("trip_filters")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return { ...data, drop: data.drop_location, createdAt: data.created_at };
}

async function deleteRemoteFilter(id) {
  const supabase = getClient();
  if (!supabase) return false;
  const { error } = await supabase.from("trip_filters").delete().eq("id", id);
  if (error) throw error;
  return true;
}

async function pushMessage({ source, groupName, rawText, parsed, matched }) {
  const supabase = getClient();
  if (!supabase) return; // not configured — no-op

  const row = {
    source,
    group_name: groupName || null,
    raw_text: rawText,
    pickup: parsed.pickup || null,
    drop_location: parsed.drop || null,
    date_text: parsed.date || null,
    time_text: parsed.time || null,
    vehicle: parsed.vehicle || null,
    passengers: parsed.passengers || null,
    price: parsed.price || null,
    contact: parsed.contact || null,
    other_details: parsed.otherDetails || null,
    matched: matched.length > 0,
    matched_filter_labels: matched.map((m) => m.label),
  };

  try {
    const { data, error } = await supabase
      .from("messages")
      .insert(row)
      .select()
      .single();
    if (error) {
      console.log("[supabase] insert failed:", error.message);
      return;
    }
    if (row.matched) {
      try {
        await sendMatchedPush(supabase, data);
      } catch (pushError) {
        console.log("[fcm] push failed:", pushError.message);
      }
    }
  } catch (err) {
    console.log("[supabase] insert error:", err.message);
  }
}

module.exports = {
  createRemoteFilter,
  deleteRemoteFilter,
  fetchRemoteFilters,
  pushMessage,
  seedRemoteFilters,
  updateRemoteFilter,
};
