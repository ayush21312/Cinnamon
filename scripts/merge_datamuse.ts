import fs from 'node:fs/promises';
import { z } from 'zod';
import { sameWordFamily } from '../lib/words';
import dictionary from '../data/words.json';

async function main() {
  const schema = z.object({
    prompts: z.record(
      z.string(),
      z.array(z.object({ word: z.string(), approved: z.boolean(), sources: z.array(z.string()) })),
    ),
  });
  const report = schema.parse(JSON.parse(await fs.readFile('work/datamuse-review.json', 'utf8')));
  const bank: Record<string, string> = JSON.parse(
    await fs.readFile('data/associations.json', 'utf8'),
  );
  const additions: Record<string, string[]> = {};
  for (const [prompt, candidates] of Object.entries(report.prompts)) {
    if (!Object.hasOwn(bank, prompt)) throw Error(`Unknown prompt: ${prompt}`);
    const words = bank[prompt].split(' ');
    for (const candidate of candidates.filter((entry) => entry.approved)) {
      const word = candidate.word;
      if (!/^[a-z][a-z-]{1,31}$/.test(word) || !Object.hasOwn(dictionary, word))
        throw Error(`Unsupported word: ${word}`);
      if ([prompt, ...words].some((existing) => sameWordFamily(existing, word))) continue;
      words.push(word);
      (additions[prompt] ??= []).push(word);
    }
    bank[prompt] = words.join(' ');
  }
  // Validate everything before writing. A backup makes the merge reversible.
  await fs.writeFile(
    'work/associations-before-datamuse.json',
    await fs.readFile('data/associations.json'),
  );
  await fs.writeFile('data/associations.json', JSON.stringify(bank, null, 2) + '\n');
  await fs.writeFile('work/datamuse-approved.json', JSON.stringify(additions, null, 2));
  console.log(
    `Merged ${Object.values(additions).flat().length} reviewed associations. Run words:build, words:check and npm test.`,
  );
}
main().catch(() => {
  console.error('Word import failed. Check the input file or connection.');
  process.exitCode = 1;
});
