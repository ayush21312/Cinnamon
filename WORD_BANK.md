# View the source and expand the word bank

Open the `outputs/cinammon` folder in your editor, or click the source links in the chat. It is an editable copy; synced project references under `sources/` stay untouched. Download and extract `cinnamon-source.zip` if you want the whole project elsewhere.

## Files to edit

| File                     | What it controls                                                        |
| ------------------------ | ----------------------------------------------------------------------- |
| `app/page.tsx`           | Screens, buttons, live word display, and local colorblind preference    |
| `app/globals.css`        | Colors, font sizes, layout, colorblind styles                           |
| `data/associations.json` | Prompt categories and manually approved related words                   |
| `scripts/build_words.py` | Dictionary, frequency, morphology, and lexical relation export          |
| `lib/words.ts`           | Validation, conservative typo correction, word families, rarity cutoffs |
| `server/engine.ts`       | Scores, timers, turn order, and rotating round starters                 |

## Add associations or a new prompt

`data/associations.json` is the main editable word bank. Each key is a prompt; its value is a space-separated list of approved English answers. Add words to an existing line, or add a new key and its answers. Use lowercase single words; a hyphenated word can be supported. Do not put multiword phrases into this format.

```json
{
  "ocean": "water fish coral submarine plankton kelp euphotic"
}
```

This is a format example, not a replacement for the full file. Preserve the existing prompts. JSON requires commas between entries and quoted keys/values. Prefer base forms; plural or tense variants do not count as separate gameplay words.

Then regenerate the derived files:

```sh
python -m pip install wordfreq==3.1.1 nltk==3.9.2
npm run words:build
npm run words:check
npm test
```

Python is needed only to rebuild data. The generator downloads WordNet once to `work/nltk`, uses measured wordfreq frequencies, and writes `words.json`, `lexical.json`, `forms.json`, `families.json`, and `prompts.json`. The generated prompt list indexes the word bank; How to play shows the seven rarity tiers instead. Avoid editing generated files directly: the next build replaces them.

In development, restart the game server after data edits so its in-memory bank reloads. For production, run `npm run build`, then restart both frontend and game server. Server restarts lose active rooms. To run locally after extracting the source, use `npm ci` and `npm run dev`.

## Current expansion

The bundled export now contains **109,230** recognized lemmas/attested inflected words and **6,709** prompt-specific WordNet relationships, plus the curated bank. WordNet relationships include synonyms, parts/substances, and children/grandchildren in its hierarchy. More dictionary entries do not mean every word is valid for every prompt. Review new associations and playtest them; lexical senses can still be broader than intended.

## Slight spelling errors and repeat prevention

Only an unknown spelling of at least four letters can be corrected automatically. It must have exactly one prompt-related candidate within one insertion, deletion, replacement, or adjacent character swap. Multiple candidates require a retry. Known English words stay intact except a unique missing/extra final s correction when the original has no verified connection (for example physic → physics for science). Autocorrection can be disabled in Settings and persists on this browser. The server validates the preference and still applies dictionary, association, and duplicate checks. Corrections are shown as `submitted → accepted` and score using the accepted word's real frequency.

Plurals and verb tenses use verified WordNet morphology and irregular-word exceptions, not generic string trimming. Forms such as fish/fishes, swim/swam/swimming, and leaf/leaves share a family and cannot earn points twice within one prompt. Recognized inflections are scored and stored as the related base word, so an uncommon spelling of a common inflection cannot inflate its rarity. Distinct derived words are not universally merged.

WordNet can assign multiple roots to an ambiguous form; the repeat rule conservatively blocks a shared verified root. Completely unfamiliar words and obscure inflections outside the export may be rejected. Add genuine missing English base words to the curated bank and regenerate; do not assign invented frequencies. Missing frequency stays Unranked with the Common point value.

## Expanded curated bank

All 155 prompts now have at least 50 separately playable curated answers (the verified minimum is 64). There are 14,445 curated prompt-answer pairs. Synonyms, objects, actions, and contextual relationships are explicitly listed; plural/tense variants do not inflate this minimum. `npm run words:check` enforces the minimum and the automated coverage test checks every entry with autocorrection disabled.

## Derived-word repeats

The rebuild also exports verified derivational families. For example tranquil/tranquility/tranquillity and brave/bravery cannot score separately for a prompt. To fill a verified gap, add a related-word group to `data/family-overrides.json`, then rebuild and run checks/tests. Avoid grouping synonyms with different roots merely because they have similar meanings. The current expanded rules retain at least 64 separately playable curated answers for every prompt.

## Everyday vocabulary expansion

Added pizza, hospital, farm, market, phone, bus, bakery, restaurant, park, and pool. Every existing prompt received additional familiar, everyday associations. Examples include ocean → blue/boat/swimming/seaweed, forest → woods, night → pajamas, and music → headphones.

Frequency helped filter candidate additions, but reviewed familiar clothing, everyday objects, and British/American spellings were retained even when less frequent in the corpus. This selection does not change rarity thresholds or fabricate frequencies. All 155 prompts have at least 64 separately playable curated answers.
