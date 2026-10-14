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

All 155 prompts now have at least 50 separately playable curated answers (the verified minimum is 70). There are 16,144 curated prompt-answer pairs. Synonyms, objects, actions, and contextual relationships are explicitly listed; plural/tense variants do not inflate this minimum. `npm run words:check` enforces the minimum and the automated coverage test checks every entry with autocorrection disabled.

## Derived-word repeats

The rebuild also exports verified derivational families. For example tranquil/tranquility/tranquillity and brave/bravery cannot score separately for a prompt. To fill a verified gap, add a related-word group to `data/family-overrides.json`, then rebuild and run checks/tests. Avoid grouping synonyms with different roots merely because they have similar meanings. The current expanded rules retain at least 70 separately playable curated answers for every prompt.

## Everyday vocabulary expansion

Added pizza, hospital, farm, market, phone, bus, bakery, restaurant, park, and pool. Every existing prompt received additional familiar, everyday associations. Examples include ocean → blue/boat/swimming/seaweed, forest → woods, night → pajamas, and music → headphones.

Frequency helped filter candidate additions, but reviewed familiar clothing, everyday objects, and British/American spellings were retained even when less frequent in the corpus. This selection does not change rarity thresholds or fabricate frequencies. All 155 prompts have at least 70 separately playable curated answers.

## Datamuse expansion (October 13, 2026)

The bundled bank contains 16,144 curated associations across 155 prompts. A development fetch produced 36,503 filtered candidates; 1,699 manually reviewed additions were merged. Every prompt retains at least 70 separately playable curated answers. `data/datamuse-approved.json` records the additions and source. Thanks to the [Datamuse API](https://www.datamuse.com/api/) for candidate suggestions. API rankings never determine rarity or automatically establish a valid relationship.

To fetch another batch (existing prompts only):

```sh
npm run words:fetch
# Or fetch just selected prompts:
npm run words:fetch -- ocean forest pizza
```

The tool queries related meanings, statistical associations, and synonyms, requesting up to 1,000 results for each query. It filters unsupported phrases, unknown words, proper-name capitalization, and families already used by the prompt/bank. Single-word dictionary recognition can still include ambiguous senses and proper names; review is required. Requests have timeouts and bounded retries for throttling/server errors. Successful responses are cached under `work/datamuse-cache/`; reruns resume using the cache. No requests happen during gameplay. `DATAMUSE_API_KEY` is optional today and server/development only. Check Datamuse's latest access terms before future runs; its published 2027 key transition dates currently differ between sections. Contact the provider about public-app usage and bulk reuse permissions as appropriate; acknowledge its contribution.

Open `work/datamuse-review.json` in VS Code. Change `approved` to `true` only for candidates with a defensible connection to that prompt. Leave weak or uncertain matches false. Then run:

```sh
npm run words:merge
npm run words:build
npm run words:check
npm test
```

The merge preserves existing answers, skips repeated families, validates recognized English words, and saves a backup under `work/`. A fresh fetch replaces the review document, so finish your review before fetching again. Clear a cached query file to refresh that query. `work/` is gitignored; only the approved bank and regenerated exports belong in your deployment. Keep frequency scoring based on wordfreq. Missing words need a separately verified dictionary expansion rather than blindly trusting API strings.

## Check counts

Run `npm run words:stats` to list the curated and separately playable answer counts for every prompt. It also saves `work/word-bank-counts.csv`. Separately playable counts exclude repeat families in bank order; lexical fallback can accept additional words. Run `npm run words:check` to verify the bank.

## Manual additions in VS Code

1. Open `data/associations.json` and search for the prompt, such as `"ocean"`.
2. Append new, genuine English single words to its existing quoted answer string, separated by spaces. Preserve all current entries and valid JSON commas/quotes. Use lowercase. Do not join phrases, add unsupported proper names, or invent spellings. Plurals, tenses and verified derived families cannot earn separate points.
3. Save, then run `npm run words:build`, `npm run words:check`, `npm test`, and `npm run words:stats`. Python needs wordfreq 3.1.1 and nltk 3.9.2 if not already installed. Rarity is calculated from wordfreq; unavailable frequency gets the safe Unranked score.
4. Restart local development to load regenerated word data. Commit/push approved source and generated data to update the hosted game. A backend deployment restarts active in-memory rooms.

For a new prompt, add a new JSON key with at least 50 separately playable related word families and run the same rebuild/check workflow. Generated files (`words.json`, `forms.json`, `families.json`, `lexical.json`, `prompts.json`) should not be edited directly.
