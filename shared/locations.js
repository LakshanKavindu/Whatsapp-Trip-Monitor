/**
 * Each entry: canonical id -> array of ways people actually write it
 * (seen in real group messages: misspellings, Sinhala script, romanized
 * variants, abbreviations). Matching is substring-based after
 * normalization, so partial/extra text around a name still matches.
 *
 * This list covers common Sri Lankan tourism/transfer hubs. It's not
 * exhaustive — add new aliases as you spot messages the system misses
 * (see README: "Improving place matching").
 */
const LOCATIONS = {
  arugambay: ["arugambay", "arugam bay", "arugambe", "arugamebe", "a bay", "arugam"],
  galle: ["galle", "ගාල්ල"],
  hiriketiya: ["hiriketiya", "hiriketiye"],
  negombo: ["negombo"],
  katunayake: ["katunayake", "katunayaka", "katunayeke", "bia airport", "airport"],
  bia: ["bia", "airport", "katunayake airport", "colombo airport"],
  pasikuda: ["pasikuda", "passikudah", "passekudah"],
  wellawaya: ["wellawaya", "wallawaya"],
  trincomalee: ["trincomalee", "trinco"],
  nilaweli: ["nilaweli"],
  anuradhapura: ["anuradhapura", "anuradapura"],
  tangalle: ["tangalle", "tangalla"],
  welikanda: ["welikanda"],
  colombo: ["colombo", "kolomba", "කොළඹ"],
  bentota: ["bentota", "benthota"],
  panadura: ["panadura"],
  ella: ["ella"],
  udawalawa: ["udawalawa", "udawalawe"],
  buduruwagala: ["buduruwagala"],
  nuwaraeliya: ["nuwaraeliya", "nuwara eliya"],
  unawatuna: ["unawatuna"],
  hatton: ["hatton"],
  kandy: ["kandy", "මහනුවර"],
  dambulla: ["dambulla"],
  kitulgala: ["kitulgala"],
  moratuwa: ["moratuwa"],
  ahangama: ["ahangama"],
  kurunegala: ["kurunegala", "කුරුණැගල", "කුරුණෑගල"],
  polpitigama: ["polpitigama", "පොල්පිතිගම"],
  piliyandala: ["piliyandala", "පිළියන්දල"],
  galkissa: ["galkissa"],
  beruwala: ["beruwala"],
  battaramulla: ["battaramulla", "බත්තරමුල්ල"],
  ginigathhena: ["ginigathhena", "ගිණිගත්හේන"],
};

// Flatten into a lookup: normalized alias string -> canonical id
function buildAliasIndex() {
  const index = new Map();
  for (const [canonical, aliases] of Object.entries(LOCATIONS)) {
    for (const alias of aliases) {
      index.set(normalizeForMatch(alias), canonical);
    }
    index.set(normalizeForMatch(canonical), canonical);
  }
  return index;
}

function normalizeForMatch(str) {
  return str
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "") // strip spaces/punctuation for loose matching
    .trim();
}

// Lowercases and collapses punctuation/emoji into single spaces, keeping
// word boundaries intact (unlike normalizeForMatch, which strips spaces
// entirely). Used for whole-word containment checks so "ella" doesn't
// match inside "borella".
function normalizeWords(str) {
  return str
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// True if `needle` appears as a whole word (or whole word-sequence, for
// multi-word place names) inside `haystack` — not merely as a substring
// of a longer word.
function containsWholeWord(haystackWords, needleWords) {
  if (!needleWords) return false;
  return (" " + haystackWords + " ").includes(" " + needleWords + " ");
}

const ALIAS_INDEX = buildAliasIndex();

/**
 * Resolve a user-typed place name (from the filter UI) to its canonical
 * group, then return every alias in that group. If the typed name isn't
 * in our table, we fall back to just the typed name itself.
 */
function resolveAliasGroup(userInput) {
  const key = normalizeForMatch(userInput);
  const canonical = ALIAS_INDEX.get(key);
  if (canonical && LOCATIONS[canonical]) {
    return [canonical, ...LOCATIONS[canonical]];
  }
  return [userInput];
}

const { fuzzyContains } = require("./fuzzy");

/**
 * Does `haystack` (raw extracted text from a message) contain the place
 * the user is filtering for (`needle`, as typed in the UI)? Matches as a
 * whole word/phrase first (so "ella" won't match inside "borella"), then
 * falls back to typo-tolerant fuzzy matching (e.g. "nuwreliya" still
 * matches "nuwaraeliya") — fuzzy matching is also whole-token, so it has
 * the same protection against matching inside a longer word.
 */
function placeMatches(haystack, needle) {
  if (!needle) return true; // empty filter = wildcard/"anywhere"
  if (!haystack) return false;

  const haystackWords = normalizeWords(haystack);
  const candidates = resolveAliasGroup(needle);

  const exact = candidates.some((c) => {
    const cWords = normalizeWords(c);
    return cWords.length > 0 && containsWholeWord(haystackWords, cWords);
  });
  if (exact) return true;

  return candidates.some((c) => fuzzyContains(haystackWords, normalizeForMatch(c)));
}

module.exports = {
  LOCATIONS,
  placeMatches,
  normalizeForMatch,
  normalizeWords,
  containsWholeWord,
  resolveAliasGroup,
};
