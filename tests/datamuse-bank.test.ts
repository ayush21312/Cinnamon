import { expect, it } from 'vitest';
import { OfflineValidator } from '../lib/words';

it('accepts reviewed Datamuse additions while unrelated answers remain rejected', () => {
  const validator = new OfflineValidator();
  for (const [prompt, answer] of [
    ['ocean', 'seawater'], ['fire', 'gunpowder'], ['forest', 'timberland'],
    ['rain', 'rainwater'], ['music', 'soundtrack'], ['kitchen', 'larder'],
    ['camera', 'camcorder'], ['hospital', 'infirmary'], ['bakery', 'patisserie'],
    ['phone', 'switchboard'],
  ]) expect(validator.validate(prompt, answer, [], false).valid, `${prompt}: ${answer}`).toBe(true);
  expect(validator.validate('ocean', 'gunpowder', [], false).valid).toBe(false);
  expect(validator.validate('pizza', 'democracy', [], false).valid).toBe(false);
  expect(validator.validate('hospital', 'infirmary', ['infirmary'], false).valid).toBe(false);
});
