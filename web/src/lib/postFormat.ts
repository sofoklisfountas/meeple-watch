// Turns post lines into clean rows (name, price, sold). Fixed rules only (no AI).
import { normalize } from '../../../shared/match.js';

const BULLET = /^\s*(?:[-–—•*·▪►✔✅☑🔹🔸👉]+|\d{1,3}\s*[.)]|\(\d{1,3}\))\s*/u;
const PRICE = /(?:€\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:€|ευρώ|ευρω|euros?|eur)(?![\p{L}]))/giu;
const SOLD = /(?<![\p{L}])(sold|πουλ[ηή]θηκε|πωλ[ηή]θηκε|δόθηκε|reserved|κρατημένο)(?![\p{L}])/iu;
const TAIL_JUNK = /\s*(?:…\s*)?(?:see less|see more|λιγότερα|δείτε περισσότερα)\s*$/iu;
// A plain number at the very end of the line, e.g. "Clank 40" or "(ΚΑΙΝΟΥΡΓΙΟ) 70".
const BARE_TAIL = /(?<![\d.,€\p{L}])(\d{1,4}(?:[.,]\d{1,2})?)\s*$/u;

export interface Row { line: string; text: string; price: string | null; sold: boolean; mine: boolean }

const hasCurrency = (s: string) => /€|ευρ[ώω]|euro?s?(?![\p{L}])/iu.test(s);

/** Is the trailing number really a price (not a year, not part of the game's name like "Memoir 44")? */
function barePrice(text: string, names: string[]): { value: string; match: string } | null {
  const m = text.match(BARE_TAIL);
  if (!m) return null;
  const num = Number(m[1].replace(',', '.'));
  if (!num || num > 2000 || (num >= 1900 && Number.isInteger(num))) return null;
  const n = normalize(text);
  if (names.some((name) => name && n.endsWith(name) && name.endsWith(` ${normalize(m[1])}`))) return null;
  if (n === normalize(m[1])) return null; // the whole line is just a number
  return { value: m[1], match: m[0] };
}

/**
 * @param names normalized names this line is known to mention (wishlist terms + recognized BGG game),
 *              used to avoid reading "Memoir 44" as "Memoir, 44€".
 * @param bareMode the post writes prices as plain numbers (decided per post).
 */
export function parseLine(line: string, terms: string[], names: string[], bareMode: boolean): Row {
  let text = line.replace(TAIL_JUNK, '').replace(BULLET, '');
  const sold = SOLD.test(text);
  const prices = [...text.matchAll(PRICE)];
  let price: string | null = null;
  if (prices.length === 1) {
    price = `${prices[0][1] ?? prices[0][2]}€`;
    text = text.replace(prices[0][0], ' ');
  } else if (!prices.length && bareMode) {
    const bp = barePrice(text, names);
    if (bp) {
      price = `${bp.value}€`;
      text = text.slice(0, text.length - bp.match.length);
    }
  }
  if (price) text = text.replace(/\s*[-–—:=>]+\s*$/u, '').replace(/^\s*[-–—:=>·]+\s*/u, '');
  text = text.replace(/\s{2,}/g, ' ').replace(/\s*[-–—:]\s*$/u, '').trim();
  const hay = ` ${normalize(line)} `;
  return { line, text: text || line.trim(), price, sold, mine: terms.some((t) => hay.includes(` ${t} `)) };
}

/** Prices written as bare numbers? Yes when 2+ lines end in a plain number with no currency. */
export function isBareMode(lines: string[]): boolean {
  let n = 0;
  for (const l of lines) {
    const t = l.replace(TAIL_JUNK, '');
    if (!hasCurrency(t) && BARE_TAIL.test(t)) n++;
  }
  return n >= 2;
}
