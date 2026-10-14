import { mkdirSync, writeFileSync } from 'node:fs';
import bank from '../data/associations.json';
import dictionary from '../data/words.json';
import { OfflineValidator } from '../lib/words';

const validator = new OfflineValidator();
const rows = Object.entries(bank)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([prompt, answers]) => {
    const words = answers.split(' ');
    const used: string[] = [];
    for (const word of words) {
      const result = validator.validate(prompt, word, used, false);
      if (result.valid) used.push(result.word);
    }
    return { prompt, listed: words.length, playable: used.length };
  });
console.table(rows);
const total = rows.reduce((sum, row) => sum + row.listed, 0);
const playable = rows.reduce((sum, row) => sum + row.playable, 0);
console.log(
  JSON.stringify(
    {
      prompts: rows.length,
      dictionaryWords: Object.keys(dictionary).length,
      curatedAssociations: total,
      distinctCuratedWords: new Set(Object.values(bank).flatMap((row) => row.split(' '))).size,
      listedPerPrompt: {
        minimum: Math.min(...rows.map((r) => r.listed)),
        maximum: Math.max(...rows.map((r) => r.listed)),
        average: +(total / rows.length).toFixed(1),
      },
      playablePerPrompt: {
        minimum: Math.min(...rows.map((r) => r.playable)),
        maximum: Math.max(...rows.map((r) => r.playable)),
        average: +(playable / rows.length).toFixed(1),
      },
    },
    null,
    2,
  ),
);
mkdirSync('work', { recursive: true });
writeFileSync(
  'work/word-bank-counts.csv',
  'Prompt,Listed associations,Separately playable curated answers\n' +
    rows.map((r) => `${r.prompt},${r.listed},${r.playable}`).join('\n') +
    '\n',
);
console.log(
  'Saved work/word-bank-counts.csv. Playable counts exclude repeat families in bank order; lexical fallback may accept additional answers.',
);
