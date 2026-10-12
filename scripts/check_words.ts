import bank from '../data/associations.json';
import listedPrompts from '../data/prompts.json';
import dictionary from '../data/words.json';
import { OfflineValidator } from '../lib/words';
let missing = 0;
const counts: number[] = [];
const validator = new OfflineValidator();
for (const [prompt, row] of Object.entries(bank)) {
  const playable: string[] = [];
  if (!listedPrompts.includes(prompt)) {
    console.error(`Regenerate data: missing category ${prompt}`);
    missing++;
  }
  for (const word of row.split(' ')) {
    if (!Object.hasOwn(dictionary, word)) {
      console.error(`Regenerate data: ${prompt} → ${word} is not indexed.`);
      missing++;
    } else if (!validator.validate(prompt, word, []).valid) {
      console.error(`Review ${prompt} → ${word}: it is not accepted.`);
      missing++;
    }
    const result = validator.validate(prompt, word, playable, false);
    if (result.valid) playable.push(result.word);
  }
  if (playable.length < 50) {
    console.error(
      `${prompt} has only ${playable.length} separately playable answers; minimum is 50.`,
    );
    missing++;
  }
  counts.push(playable.length);
}
for (const prompt of listedPrompts) {
  if (!Object.hasOwn(bank, prompt)) {
    console.error(`Regenerate data: removed prompt ${prompt} is still indexed.`);
    missing++;
  }
}
if (missing) process.exitCode = 1;
else
  console.log(
    `${Object.keys(bank).length} prompts and ${Object.keys(dictionary).length.toLocaleString()} words checked. Minimum separately playable curated answers: ${Math.min(...counts)}. Run npm test after changes.`,
  );
