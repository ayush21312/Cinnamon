import bank from '../data/associations.json';
import dictionary from '../data/words.json';
import lexical from '../data/lexical.json';
import formsData from '../data/forms.json';
import familyData from '../data/families.json';
const derivations = familyData as Record<string, string>;
export const prompts = Object.keys(bank);
const curated = bank as Record<string, string>;
const frequencies = dictionary as Record<string, number>;
const relations = lexical as Record<string, Record<string, string>>;
const forms = formsData as Record<string, string[]>;
function formsOf(word: string) {
  return Object.hasOwn(forms, word) ? forms[word] : [];
}
function curatedWords(prompt: string) {
  return Object.hasOwn(curated, prompt) ? curated[prompt].split(' ') : [];
}
function lexicalReason(prompt: string, word: string) {
  return Object.hasOwn(relations, prompt) && Object.hasOwn(relations[prompt], word)
    ? relations[prompt][word]
    : undefined;
}
export function wordFamily(word: string): string[] {
  const roots = [word, ...formsOf(word)];
  return [
    ...new Set([
      ...roots,
      ...roots
        .filter((root) => Object.hasOwn(derivations, root))
        .map((root) => `family:${derivations[root]}`),
    ]),
  ];
}
function matchesPrompt(word: string, prompt: string) {
  const roots = new Set([prompt, ...formsOf(prompt)]);
  return [word, ...formsOf(word)].some((root) => roots.has(root));
}
export function sameWordFamily(a: string, b: string) {
  const family = new Set(wordFamily(a));
  return wordFamily(b).some((root) => family.has(root));
}
// At most one insertion, deletion, substitution, or adjacent transposition.
export function oneEditAway(a: string, b: string) {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const indices = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) indices.push(i);
    return (
      indices.length === 1 ||
      (indices.length === 2 &&
        indices[1] === indices[0] + 1 &&
        a[indices[0]] === b[indices[1]] &&
        a[indices[1]] === b[indices[0]])
    );
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  let i = 0,
    j = 0,
    skips = 0;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i++;
      j++;
    } else {
      if (++skips > 1) return false;
      j++;
    }
  }
  return true;
}
const candidateCache = new Map<string, string[]>();
function candidates(prompt: string) {
  let words = candidateCache.get(prompt);
  if (!words) {
    words = [
      ...new Set([
        ...curatedWords(prompt),
        ...Object.keys(Object.hasOwn(relations, prompt) ? relations[prompt] : {}),
      ]),
    ].filter((w) => w !== prompt && Object.hasOwn(frequencies, w));
    candidateCache.set(prompt, words);
  }
  return words;
}
export const tiers = ['Common', 'Familiar', 'Uncommon', 'Rare', 'Obscure', 'Esoteric', 'Arcane'];
export const defaultPoints = [10, 20, 35, 55, 80, 120, 175];
export const thresholds = [5, 4.3, 3.6, 2.9, 2.2, 1.5];
export function normalize(word: string) {
  return word.normalize('NFKC').trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
}
export function rarity(word: string, points = defaultPoints) {
  const zipf = Object.hasOwn(frequencies, word) ? frequencies[word] : 0;
  // Missing or zero-frequency entries get a conservative Common fallback.
  const tierIndex = !zipf ? 0 : thresholds.findIndex((t) => zipf >= t);
  const index = tierIndex < 0 ? 6 : tierIndex;
  return {
    tier: !zipf ? 'Unranked' : tiers[index],
    tierIndex: index,
    points: points[index],
    zipf: zipf || null,
  };
}
export type Validation = {
  valid: boolean;
  word: string;
  reason: string;
  relationship?: 'curated' | 'lexical';
  originalWord?: string;
};
export interface AssociationValidator {
  validate(
    prompt: string,
    answer: string,
    used: readonly string[],
    autocorrect?: boolean,
  ): Validation;
}
export class OfflineValidator implements AssociationValidator {
  validate(
    prompt: string,
    answer: string,
    used: readonly string[],
    autocorrect = true,
  ): Validation {
    let word = normalize(answer);
    const originalWord = word;
    if (!/^[a-z][a-z'-]{1,31}$/.test(word))
      return { valid: false, word, reason: 'Not found in the word list' };
    if (matchesPrompt(word, prompt))
      return {
        valid: false,
        word,
        reason: 'word is already repeated',
      };
    const directlyRelated = (w: string) =>
      [w, ...formsOf(w)].some(
        (base) => curatedWords(prompt).includes(base) || lexicalReason(prompt, base),
      );
    // Known English spellings stay intact, except a missing/extra final s when
    // the original has no verified connection and the alternative does.
    const missingS =
      !directlyRelated(word) &&
      candidates(prompt).filter((w) => w === word + 's' || word === w + 's');
    if (!Object.hasOwn(frequencies, word) || (autocorrect && missingS && missingS.length === 1)) {
      const matches =
        autocorrect && word.length >= 4
          ? candidates(prompt).filter((candidate) => oneEditAway(word, candidate))
          : [];
      if (matches.length === 1) word = matches[0];
      else
        return {
          valid: false,
          word,
          reason: 'Not found in the word list',
        };
    }
    if (matchesPrompt(word, prompt) || used.some((played) => sameWordFamily(played, word)))
      return {
        valid: false,
        word,
        reason: 'word is already repeated',
      };
    const relatedWord = [word, ...formsOf(word)].find(
      (candidate) => curatedWords(prompt).includes(candidate) || lexicalReason(prompt, candidate),
    );
    if (relatedWord) {
      const base =
        formsOf(word).find((candidate) => candidates(prompt).includes(candidate)) ?? relatedWord;
      const correction = base !== originalWord ? { originalWord } : {};
      const relationship = curatedWords(prompt).includes(relatedWord)
        ? ('curated' as const)
        : ('lexical' as const);
      return {
        valid: true,
        word: base,
        reason: `${base !== originalWord ? `Accepted ${originalWord} as ${base}. ` : ''}${relationship === 'curated' ? `Curated association with ${prompt}.` : lexicalReason(prompt, relatedWord)}`,
        relationship,
        ...correction,
      };
    }
    return {
      valid: false,
      word,
      reason: 'Not found in the word list',
    };
  }
}
