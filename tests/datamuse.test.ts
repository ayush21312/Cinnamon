import { describe, expect, it } from 'vitest';
import { collectCandidates } from '../lib/datamuse';
describe('Datamuse candidate import', () => {
  it('filters unknown words, names, phrases, prompt and inflection repeats; keeps provenance without auto-approving', () => {
    const result = collectCandidates(
      'ocean',
      ['fish'],
      {
        ml: [
          { word: 'fish' },
          { word: 'fishes' },
          { word: 'ocean' },
          { word: 'sea lion' },
          { word: 'Atlantic' },
          { word: 'gibberishzz' },
          { word: 'kelp', score: 99999 },
        ],
        rel_trg: [{ word: 'kelp' }],
      },
      () => true,
      (a, b) => a === b || (a === 'fish' && b === 'fishes'),
    );
    // Explicit word recognition prevents arbitrary API tokens becoming valid English.
    const filtered = collectCandidates(
      'ocean',
      ['fish'],
      { ml: [{ word: 'gibberishzz' }] },
      () => false,
      (a, b) => a === b,
    );
    expect(filtered).toEqual([]);
    expect(result.find((word) => word.word === 'kelp')).toEqual({
      word: 'kelp',
      sources: ['ml', 'rel_trg'],
      approved: false,
    });
    expect(result.map((word) => word.word)).not.toContain('fishes');
    expect(result.map((word) => word.word)).not.toContain('Atlantic');
    expect(result.map((word) => word.word)).not.toContain('sea lion');
  });
});
