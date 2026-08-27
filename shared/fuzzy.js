function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * True if any whitespace/punctuation-delimited token in `haystack` is
 * within edit-distance tolerance of `needle` (already-normalized
 * strings, letters/digits only). Skips very short needles (<5 chars)
 * since fuzzy-matching short words produces too many false positives.
 */
function fuzzyContains(haystack, needle) {
  if (needle.length < 5) return false;

  const maxDist = needle.length <= 6 ? 1 : needle.length <= 10 ? 2 : 3;
  const tokens = haystack.match(/[\p{L}\p{N}]+/gu) || [];

  return tokens.some((t) => {
    if (Math.abs(t.length - needle.length) > maxDist) return false;
    return levenshtein(t, needle) <= maxDist;
  });
}

module.exports = { levenshtein, fuzzyContains };
