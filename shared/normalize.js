/**
 * Normalizes decorative Unicode text styles (Mathematical Alphanumeric
 * Symbols block) back to plain ASCII, e.g. "𝐏𝐢𝐜𝐤" -> "Pick",
 * "𝗡𝗜𝗟𝗔𝗪𝗘𝗟𝗜" -> "NILAWELI", "𝑯𝒊𝒓𝒆" -> "Hire".
 *
 * People in these tourism groups love stylized fonts (bold, italic,
 * sans-serif-bold, etc.), and without this step every label-matching
 * regex would silently fail on stylized messages.
 */

// [uppercaseStart, lowercaseStart] code points for each style block that
// covers the full A-Z / a-z range contiguously.
const STYLE_RANGES = [
  [0x1d400, 0x1d41a], // Bold
  [0x1d434, 0x1d44e], // Italic (has a few exceptions, handled below)
  [0x1d468, 0x1d482], // Bold Italic
  [0x1d5a0, 0x1d5ba], // Sans-Serif
  [0x1d5d4, 0x1d5ee], // Sans-Serif Bold
  [0x1d608, 0x1d622], // Sans-Serif Italic
  [0x1d63c, 0x1d656], // Sans-Serif Bold Italic
  [0x1d670, 0x1d68a], // Monospace
];

// Digit styles (Mathematical bold, double-struck, sans-serif, sans bold,
// monospace digits) -> plain 0-9. Each block is 10 code points 0-9.
const DIGIT_STARTS = [0x1d7ce, 0x1d7d8, 0x1d7e2, 0x1d7ec, 0x1d7f6];

// A few well-known italic exceptions that break the simple offset math.
const ITALIC_EXCEPTIONS = {
  0x210e: "h", // PLANCK CONSTANT used as italic h
  0x1d6a4: "i", // MATHEMATICAL ITALIC SMALL DOTLESS I
  0x1d6a5: "j", // MATHEMATICAL ITALIC SMALL DOTLESS J
};

function normalizeUnicodeLetters(input) {
  let out = "";
  for (const ch of input) {
    const cp = ch.codePointAt(0);

    if (ITALIC_EXCEPTIONS[cp]) {
      out += ITALIC_EXCEPTIONS[cp];
      continue;
    }

    let mapped = null;

    for (const [upperStart, lowerStart] of STYLE_RANGES) {
      if (cp >= upperStart && cp < upperStart + 26) {
        mapped = String.fromCharCode(65 + (cp - upperStart)); // A-Z
        break;
      }
      if (cp >= lowerStart && cp < lowerStart + 26) {
        mapped = String.fromCharCode(97 + (cp - lowerStart)); // a-z
        break;
      }
    }

    if (mapped === null) {
      for (const digitStart of DIGIT_STARTS) {
        if (cp >= digitStart && cp < digitStart + 10) {
          mapped = String.fromCharCode(48 + (cp - digitStart)); // 0-9
          break;
        }
      }
    }

    out += mapped !== null ? mapped : ch;
  }
  return out;
}

// Zero-width and invisible characters that sometimes sneak between words
// (zero-width joiner/non-joiner/space, variation selectors).
const INVISIBLE_CHARS_RE = /[\u200B-\u200F\uFEFF\u180E]/g;

function normalizeText(raw) {
  if (!raw) return "";
  let text = normalizeUnicodeLetters(raw);
  text = text.replace(INVISIBLE_CHARS_RE, "");
  return text;
}

// Strips leading characters that are neither letters nor digits (emoji,
// punctuation, arrows, decorative separators like ">:)", "÷", "➡️").
// Works for Latin and Sinhala (and any Unicode letter/number) via \p{L}/\p{N}.
function stripLeadingNonWord(str) {
  return str.replace(/^[^\p{L}\p{N}]+/u, "");
}

module.exports = { normalizeText, stripLeadingNonWord };
