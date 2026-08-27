const { normalizeForMatch, normalizeWords, containsWholeWord } = require("./locations");
const { fuzzyContains } = require("./fuzzy");

const VEHICLES = {
  sedan: ["sedan", "car", "any car", "good sedan", "prius or good sedan"],
  kdh: ["kdh", "kdh van", "kdh high", "kdh high roof", "kdh flat", "kdh flatroof", "kdh e25", "e25"],
  van: ["van", "mini van", "minivan", "non ac van", "nonac van", "ac van", "a/c van", "fr van"],
  suv: ["suv"],
  prius: ["prius", "shuttle", "prius shuttle"],
  mpv: ["voxy", "noha", "noah", "glory", "7 seater"],
  any: ["any", "any car", "any vehicle"],
};

function buildVehicleIndex() {
  const index = new Map();
  for (const [canonical, aliases] of Object.entries(VEHICLES)) {
    for (const alias of aliases) index.set(normalizeForMatch(alias), canonical);
    index.set(normalizeForMatch(canonical), canonical);
  }
  return index;
}

const VEHICLE_INDEX = buildVehicleIndex();

function resolveVehicleGroup(userInput) {
  const key = normalizeForMatch(userInput);
  const canonical = VEHICLE_INDEX.get(key);
  if (canonical && VEHICLES[canonical]) return [canonical, ...VEHICLES[canonical]];
  return [userInput];
}

function vehicleMatches(haystack, needle) {
  if (!needle) return true; // empty filter = any vehicle
  if (!haystack) return false;

  const haystackWords = normalizeWords(haystack);
  const candidates = resolveVehicleGroup(needle);

  const exact = candidates.some((c) => {
    const cWords = normalizeWords(c);
    return cWords.length > 0 && containsWholeWord(haystackWords, cWords);
  });
  if (exact) return true;

  return candidates.some((c) => fuzzyContains(haystackWords, normalizeForMatch(c)));
}

module.exports = { VEHICLES, vehicleMatches };
