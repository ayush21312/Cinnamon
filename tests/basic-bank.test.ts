import { expect, it } from 'vitest';
import { OfflineValidator } from '../lib/words';

it('accepts everyday answers for the new prompts and familiar answers for existing prompts', () => {
  const validator = new OfflineValidator();
  const examples = [
    ['pizza', 'cheese'], ['hospital', 'doctor'], ['farm', 'cow'],
    ['market', 'shop'], ['phone', 'call'], ['bus', 'driver'],
    ['bakery', 'bread'], ['restaurant', 'menu'], ['park', 'grass'],
    ['pool', 'water'], ['ocean', 'boat'], ['ocean', 'blue'],
    ['forest', 'woods'], ['night', 'pajamas'], ['music', 'headphones'],
  ];
  for (const [prompt, word] of examples) {
    expect(validator.validate(prompt, word, [], false).valid, `${prompt} → ${word}`).toBe(true);
  }
  expect(validator.validate('pizza', 'democracy', [], false).valid).toBe(false);
  expect(validator.validate('phone', 'frog', [], false).valid).toBe(false);
});
