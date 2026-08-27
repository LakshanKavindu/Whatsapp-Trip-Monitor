const { normalizeText, stripLeadingNonWord } = require("./normalize");

// Label aliases per field, longest/most-specific first. Matching requires
// the (unicode-normalized, leading-symbol-stripped) line to START WITH one
// of these, followed by a non-letter character — this avoids "Today"
// falsely matching the "to" alias, etc.
const FIELD_LABELS = {
  pickup: [
    "pick up locatio", "pick up location", "pickup location", "pick-up",
    "pick up", "pickup", "picup", "pick", "from", "start",
    // Sinhala
    "ආරම්භ ස්ථානය", "ලබාගන්නා ස්ථානය", "ගමන් ආරම්භය", "ආරම්භය", "පිකප්",
  ],
  drop: [
    "drop off location", "dro location", "drop location", "drop off",
    "dropoff", "drop-off", "drop", "dro", "destination", "to",
    // Sinhala
    "බාහිර වන ස්ථානය", "යන ස්ථානය", "ගමනාන්තය", "ඩ්‍රොප්",
  ],
  route: ["route", "root", "routes", "මාර්ගය"],
  date: ["date", "data", "දිනය"],
  time: ["time", "වේලාව", "වේලා"],
  vehicle: [
    "vehicle type", "vehicle", "type",
    "වාහන වර්ගය", "වාහනය",
  ],
  passengers: [
    "passengers", "passenger", "pax", "pas",
    "මගීන්", "පැසිංජර්",
  ],
  price: [
    "amount", "price", "rate", "pay",
    "ගාස්තුව", "මුදල", "මිල",
  ],
  commission: ["commission", "com", "කොමිස්"],
  contact: [
    "contact number", "contact", "telephone number", "telephone",
    "phone number", "call", "phone", "t.p", "tp",
    "දුරකථන අංකය", "දුරකථනය", "ඇමතුම",
  ],
};

// Sorted longest-first within each field so "pick up location" is tried
// before the shorter "pick".
for (const key of Object.keys(FIELD_LABELS)) {
  FIELD_LABELS[key].sort((a, b) => b.length - a.length);
}

const PHONE_RE = /0\d{2}[\s-]?\d{3}[\s-]?\d{4}\b|0\d{9}\b/;

// Filler words that occasionally follow a label alone on a line (e.g.
// "Drop only" as a note, not an actual place) — never accepted as a value.
const JUNK_VALUES = new Set(["only", "off", "up", "down", "via", "n/a", "-", "tbd", ""]);

// Aliases used to detect a SECOND label glued onto the same line after the
// first (e.g. "Type: FR van    pay: 32000"). Short/generic aliases like
// "to" or "pax" are excluded here to avoid false splits mid-sentence.
const GLUE_DETECTOR_EXCLUDE = new Set(["to", "com", "tp", "type"]);
const GLUE_DETECTORS = [];
for (const [field, aliases] of Object.entries(FIELD_LABELS)) {
  for (const alias of aliases) {
    if (alias.length >= 3 && !GLUE_DETECTOR_EXCLUDE.has(alias)) {
      GLUE_DETECTORS.push({ field, alias });
    }
  }
}
GLUE_DETECTORS.sort((a, b) => b.alias.length - a.alias.length);

function truncateAtNextLabel(value) {
  const lower = value.toLowerCase();
  let cutAt = -1;
  for (const { alias } of GLUE_DETECTORS) {
    // must be preceded by whitespace/punctuation (a real new label start,
    // not a substring inside a word)
    const re = new RegExp(`(?:^|[\\s,;])${alias}\\b`, "i");
    const m = lower.match(re);
    if (m && m.index !== undefined) {
      const pos = m.index + (m[0].length - alias.length - (m[0].length - alias.length > 0 ? 0 : 0));
      const actualPos = lower.indexOf(alias, m.index);
      if (actualPos > 0 && (cutAt === -1 || actualPos < cutAt)) cutAt = actualPos;
    }
  }
  return cutAt > 0 ? value.slice(0, cutAt).trim() : value;
}

const { levenshtein } = require("./fuzzy");

function matchLabel(lineCore) {
  const lower = lineCore.toLowerCase();
  for (const [field, aliases] of Object.entries(FIELD_LABELS)) {
    for (const alias of aliases) {
      if (lower.startsWith(alias)) {
        const nextChar = lower.charAt(alias.length);
        // require a non-letter boundary after the alias (avoid "to" matching "today")
        if (!nextChar || !/[a-z]/.test(nextChar)) {
          const rest = lineCore.slice(alias.length);
          let value = stripLeadingNonWord(rest).trim();
          value = truncateAtNextLabel(value).trim();
          return { field, value };
        }
      }
    }
  }
  return null;
}

// Fallback for typo'd labels (e.g. "Picku" instead of "Pickup"): compares
// the line's leading word against single-word ASCII aliases by edit
// distance. Only single-word aliases (no "pick up") since comparing a
// multi-word alias to one typo'd word doesn't make sense, and only ASCII
// (Sinhala fuzzy label-matching would need different tuning).
function fuzzyMatchLabel(lineCore) {
  const leadingWordMatch = lineCore.match(/^[\p{L}\p{N}]+/u);
  if (!leadingWordMatch) return null;
  const leadingWord = leadingWordMatch[0];
  if (leadingWord.length < 4) return null;
  const lowerWord = leadingWord.toLowerCase();

  let best = null;
  for (const [field, aliases] of Object.entries(FIELD_LABELS)) {
    for (const alias of aliases) {
      if (alias.includes(" ") || alias.length < 4 || /[^\x00-\x7F]/.test(alias)) continue;
      const maxDist = alias.length <= 6 ? 1 : 2;
      const dist = levenshtein(lowerWord, alias);
      if (dist > 0 && dist <= maxDist && (!best || dist < best.dist)) {
        best = { field, alias, dist };
      }
    }
  }
  if (!best) return null;

  const rest = lineCore.slice(leadingWord.length);
  let value = stripLeadingNonWord(rest).trim();
  value = truncateAtNextLabel(value).trim();
  return { field: best.field, value };
}

function splitRoute(value) {
  const m = value.match(/^(.{1,40}?)\s*[-–—]?\s*\bto\b\s*[-–—]?\s*(.{1,60})$/i);
  if (m) return { pickup: m[1].trim(), drop: m[2].trim() };
  return null;
}

/**
 * Parses a raw WhatsApp group message into structured trip fields.
 * Returns an object; any field not found is an empty string.
 */
function parseMessage(rawText) {
  const normalized = normalizeText(rawText || "");
  const lines = normalized.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const fields = {
    pickup: "", drop: "", date: "", time: "", vehicle: "",
    passengers: "", price: "", commission: "", contact: "",
  };

  const consumedLineIndexes = new Set();
  const rejectedValueLineIndexes = new Set(); // label matched, but value looked invalid

  // Pass 1: explicit labeled lines (exact, then typo-tolerant fallback)
  lines.forEach((line, i) => {
    const core = stripLeadingNonWord(line);
    if (!core) return;

    const match = matchLabel(core) || fuzzyMatchLabel(core);
    if (!match) return;

    consumedLineIndexes.add(i);

    if (match.field === "route") {
      const split = splitRoute(match.value);
      if (split) {
        if (!fields.pickup) fields.pickup = split.pickup;
        if (!fields.drop) fields.drop = split.drop;
      }
      return;
    }

    if (fields[match.field] !== undefined && !fields[match.field]) {
      const cleanValue = match.value.trim();

      if (JUNK_VALUES.has(cleanValue.toLowerCase())) {
        rejectedValueLineIndexes.add(i);
        return;
      }

      // Contact values should look like a phone number (at least 5
      // digits) — otherwise a note like "Contact customer soon as
      // possible" gets accepted as the value and blocks the real phone
      // number (found elsewhere in the message) from ever being used.
      if (match.field === "contact") {
        const digitCount = (cleanValue.match(/\d/g) || []).length;
        if (digitCount < 5) {
          rejectedValueLineIndexes.add(i);
          return;
        }
      }

      fields[match.field] = cleanValue;
    }
  });

  // Pass 2: unlabeled "X to Y" lines fill any still-empty pickup/drop
  if (!fields.pickup || !fields.drop) {
    lines.forEach((line, i) => {
      if (consumedLineIndexes.has(i)) return;
      if (fields.pickup && fields.drop) return;

      const core = stripLeadingNonWord(line);
      if (!core || core.length > 80) return;

      const split = splitRoute(core);
      if (split) {
        if (!fields.pickup) fields.pickup = split.pickup;
        if (!fields.drop) fields.drop = split.drop;
        consumedLineIndexes.add(i);
      }
    });
  }

  // Pass 3: fully unlabeled multi-line routes, where "to" sits alone on
  // its own line, e.g. "Arugamby" / "To" / "Kitulgala"
  if (!fields.pickup || !fields.drop) {
    const toLineIndex = lines.findIndex(
      (l) => stripLeadingNonWord(l).trim().toLowerCase() === "to"
    );
    if (toLineIndex > 0 && toLineIndex < lines.length - 1) {
      const before = stripLeadingNonWord(lines[toLineIndex - 1]).trim();
      const after = stripLeadingNonWord(lines[toLineIndex + 1]).trim();
      if (!fields.pickup && before && before.length <= 40) {
        fields.pickup = before;
        consumedLineIndexes.add(toLineIndex - 1);
      }
      if (!fields.drop && after && after.length <= 40) {
        fields.drop = after;
        consumedLineIndexes.add(toLineIndex + 1);
      }
      consumedLineIndexes.add(toLineIndex);
    }
  }

  // Fallback: phone number scan across the whole message, in case no
  // "contact"/"call" label was recognized (or its value was rejected above)
  if (!fields.contact) {
    const phoneMatch = normalized.match(PHONE_RE);
    if (phoneMatch) {
      fields.contact = phoneMatch[0];
      const phoneLineIndex = lines.findIndex((l) => l.includes(phoneMatch[0]));
      if (phoneLineIndex !== -1) consumedLineIndexes.add(phoneLineIndex);
    }
  }

  // Other details: anything not captured by a structured field above —
  // either a line with no recognized label at all, or a line whose label
  // matched but whose value was rejected (e.g. a non-phone "contact" note)
  // — so nothing from the original message silently disappears.
  const otherDetailsLines = [];
  lines.forEach((line, i) => {
    if (consumedLineIndexes.has(i) && !rejectedValueLineIndexes.has(i)) return;
    const core = stripLeadingNonWord(line).trim();
    if (core.length < 2) return;
    otherDetailsLines.push(core);
  });
  const otherDetails = otherDetailsLines.join(" \u2022 "); // " • " separator

  // Trim trailing decoration (emoji/symbols) left over on any field
  for (const key of Object.keys(fields)) {
    fields[key] = fields[key].replace(/[^\p{L}\p{N})\]/=%.]+$/u, "").trim();
  }

  return {
    ...fields,
    otherDetails,
    rawText: rawText || "",
    normalizedText: normalized,
  };
}

module.exports = { parseMessage };
