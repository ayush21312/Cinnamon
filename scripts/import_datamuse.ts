import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import { z } from 'zod';
import bank from '../data/associations.json';
import dictionary from '../data/words.json';
import { sameWordFamily } from '../lib/words';
import { collectCandidates } from '../lib/datamuse';

async function main() {
  dotenv.config({ path: '.env.local', quiet: true });
  dotenv.config({ quiet: true });
  const schema = z.array(z.object({ word: z.string(), score: z.number().optional() }));
  const prompts = process.argv.slice(2);
  const selected = prompts.length ? prompts : Object.keys(bank);
  const rows = bank as Record<string, string>;
  for (const prompt of selected)
    if (!Object.hasOwn(rows, prompt)) throw Error(`Unknown prompt: ${prompt}`);
  await fs.mkdir('work/datamuse-cache', { recursive: true });
  const report: Record<string, ReturnType<typeof collectCandidates>> = {};
  let failures = 0;
  for (const [index, prompt] of selected.entries()) {
    const responses: Record<string, z.infer<typeof schema>> = {};
    for (const source of ['ml', 'rel_trg', 'rel_syn']) {
      const cache = `work/datamuse-cache/${prompt}-${source}.json`;
      try {
        try {
          responses[source] = schema.parse(JSON.parse(await fs.readFile(cache, 'utf8')));
          continue;
        } catch {
          /* Missing/invalid cache: fetch again. */
        }
        const url = new URL('https://api.datamuse.com/words');
        url.searchParams.set(source, prompt);
        url.searchParams.set('max', '1000');
        if (process.env.DATAMUSE_API_KEY) url.searchParams.set('key', process.env.DATAMUSE_API_KEY);
        for (let attempt = 0; attempt < 3; attempt++) {
          const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
          if ((response.status === 429 || response.status >= 500) && attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          if (!response.ok) throw Error(`HTTP ${response.status}`);
          responses[source] = schema.parse(await response.json());
          await fs.writeFile(cache, JSON.stringify(responses[source]));
          break;
        }
      } catch (error) {
        // Never include a request URL or key in errors.
        console.error(
          `${prompt}/${source}: ${error instanceof Error ? error.message : 'Request failed'}`,
        );
        failures++;
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    report[prompt] = collectCandidates(
      prompt,
      rows[prompt].split(' '),
      responses,
      (word) => Object.hasOwn(dictionary, word),
      sameWordFamily,
    );
    console.log(`${index + 1}/${selected.length} ${prompt}: ${report[prompt].length} candidates`);
    await fs.writeFile(
      'work/datamuse-review.json',
      JSON.stringify(
        {
          source: 'https://www.datamuse.com/api/',
          fetchedAt: new Date().toISOString(),
          prompts: report,
        },
        null,
        2,
      ),
    );
  }
  console.log(
    `${Object.values(report).flat().length} candidates saved to work/datamuse-review.json. Mark approved: true only after review, then run npm run words:merge.`,
  );
  if (failures) {
    console.error(`${failures} failed queries; rerun to resume from cache.`);
    process.exitCode = 1;
  }
}
main().catch(() => {
  console.error('Word import failed. Check the input file or connection.');
  process.exitCode = 1;
});
