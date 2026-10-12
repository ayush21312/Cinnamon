# Offline word data

The checked-in files are generated from **wordfreq 3.1.1** by Robyn Speer and **Princeton WordNet 3.0** through NLTK 3.9.2. The server does not download a dictionary at runtime. `words.json` maps 109,219 WordNet single-word lemmas, verified inflections, and explicitly curated English words to English large-list Zipf frequency estimates. `forms.json` holds verified noun/verb roots; `prompts.json` is the category list shown in How to play. `lexical.json` holds prompt-specific structural relations with definitions as explanations. `associations.json` contains 145 hand-authored recognizable prompt topics and direct/contextual answers.

## Frequency thresholds

Zipf is log10 estimated occurrences per billion words. It measures corpus use, not how difficult a person considers the word. Thresholds are configurable in `lib/words.ts`, and points are configurable per room.

| Tier     | Zipf range      | Default points               |
| -------- | --------------- | ---------------------------- |
| Common   | ≥ 5.00          | 10                           |
| Familiar | 4.30–4.99       | 20                           |
| Uncommon | 3.60–4.29       | 35                           |
| Rare     | 2.90–3.59       | 55                           |
| Obscure  | 2.20–2.89       | 80                           |
| Esoteric | 1.50–2.19       | 120                          |
| Arcane   | > 0 and < 1.50  | 175                          |
| Unranked | missing or zero | Common value (10 by default) |

The 0.7-wide bands represent about a fivefold decrease in corpus frequency per tier. These are transparent initial game design cutoffs, not a scientifically validated measure of vocabulary knowledge. Frequency estimates pool heterogeneous corpora and have sampling and demographic biases; rare tail measurements are especially uncertain. Missing words are not proof of extreme rarity.

Measured calibration from the bundled dataset:

| Word        | Zipf | Tier     | Points |
| ----------- | ---- | -------- | ------ |
| water       | 5.52 | Common   | 10     |
| fish        | 4.90 | Familiar | 20     |
| coral       | 3.86 | Uncommon | 35     |
| submarine   | 3.81 | Uncommon | 35     |
| abyssal     | 2.39 | Obscure  | 80     |
| bathymetry  | 1.93 | Esoteric | 120    |
| petrichor   | 1.60 | Esoteric | 120    |
| thaumaturgy | 1.39 | Arcane   | 175    |

No length-based scoring or LLM rankings are used. A technical term can be common; a short word can be rare. Dialect, polysemy, and inflected spellings can affect frequency. Separate word existence and relationship gates keep a low-frequency random string from scoring.

## Validation boundaries

Curated associations are accepted with a prompt explanation. WordNet structural relations include all prompt senses, hyponyms up to two levels, part meronyms, and substance meronyms. The two-level expansion follows only hyponym relationships, not arbitrary graph edges; there is no generic graph walk, no arbitrary similarity threshold, and no blanket acceptance of dictionary words. Contextual links are curated rather than inferred from an expensive model. WordNet may nevertheless expose an unintended sense, and the bank may miss valid creative associations. This is an explainable MVP, not universal semantic understanding.

Most proper names and multiword lemmas are excluded by the export filter; curated mythological concepts like phoenix and dragon are intentionally allowed as common English nouns. English-only, single-word coverage, morphology, profanity moderation, dialect coverage, and adversarial association evaluation need further work before ranked play. At crowded tables use fewer turns per prompt while the bank is expanded.

## Regenerate

```sh
python -m pip install wordfreq==3.1.1 nltk==3.9.2
python scripts/build_words.py
```

Python is a build-time tool only. The script downloads WordNet to a scratch directory, filters lemmas, adds curated terms, computes Zipf values, and exports compact JSON. To change coverage, edit the curated bank and regenerate words.json, lexical.json, forms.json, and prompts.json. Run npm run words:check and npm test. See ../WORD_BANK.md for the editing workflow. The fallback is intentionally safe when frequencies are zero.

## Attribution and license

- Robyn Speer (2022), _rspeer/wordfreq: v3.0 (v3.0.2)_, [Zenodo DOI](https://doi.org/10.5281/zenodo.7199437). Frequency export generated with version 3.1.1. Original [wordfreq source and data documentation](https://github.com/rspeer/wordfreq), [data sources](https://github.com/rspeer/wordfreq/blob/master/README.md#sources-and-license). Its software is Apache 2.0; the frequency data and this transformed frequency export are **CC BY-SA 4.0**. Values were filtered into a WordNet-based dictionary; no frequency estimates were invented. Full license and upstream source attribution are included alongside the data.
- Princeton University, WordNet 3.0: [license and commercial use](https://wordnet.princeton.edu/license-and-commercial-use). Definitions and dictionary lemmas retain the supplied WordNet license in `LICENSE-wordnet.txt`.
- `associations.json` is an original Cinammon curated bank. Its scoring estimates come from the attributed frequency source, not manual rarity assignments.

Data licenses apply to the relevant derived data files, separately from the application code. Preserve these notices when distributing or regenerating the exports.
