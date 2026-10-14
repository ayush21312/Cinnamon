export type Candidate = { word: string; sources: string[]; approved: boolean };
export type DatamuseWord = { word: string; score?: number };

// API rank is evidence for review, never proof of association or a rarity score.
export function collectCandidates(
  prompt: string,
  existing: string[],
  responses: Record<string, DatamuseWord[]>,
  isKnown: (word: string) => boolean,
  sameFamily: (a: string, b: string) => boolean,
): Candidate[] {
  const found = new Map<string, Candidate>();
  const reserved = [prompt, ...existing];
  for (const [source, results] of Object.entries(responses)) {
    for (const result of results) {
      // Reject proper names, phrases and unsupported tokens; do not join phrases.
      if (!/^[a-z][a-z-]{1,31}$/.test(result.word) || !isKnown(result.word)) continue;
      if (reserved.some((word) => sameFamily(word, result.word))) continue;
      const candidate = found.get(result.word) ?? {
        word: result.word,
        sources: [],
        approved: false,
      };
      if (!candidate.sources.includes(source)) candidate.sources.push(source);
      found.set(result.word, candidate);
    }
  }
  return [...found.values()];
}
