"""Offline, reproducible data generation. pip install wordfreq==3.1.1 nltk==3.9.2."""
import json, re, pathlib, os, nltk
from wordfreq import zipf_frequency, top_n_list
from nltk.corpus import wordnet as wn
root = pathlib.Path(__file__).resolve().parents[1]
scratch = pathlib.Path(os.environ.get('CINAMMON_NLTK_DATA', str(root / 'work/nltk')))
nltk.data.path.insert(0, str(scratch))
if not (scratch / 'corpora/wordnet.zip').exists() and not (scratch / 'corpora/wordnet').exists():
    nltk.download('wordnet', download_dir=str(scratch), quiet=True, raise_on_error=True)
curated = json.loads((root / 'data/associations.json').read_text(encoding='utf-8'))
dictionary = set(w.lower() for w in wn.all_lemma_names() if re.fullmatch(r'[a-z][a-z-]{1,31}', w))
dictionary.update(w for row in curated.values() for w in row.split())
# Attested inflections, verified against WordNet noun/verb morphology. This is
# not blind suffix stripping: irregular plurals and tenses use its exceptions.
forms = {}
for word in sorted(dictionary | set(top_n_list('en', 200000))):
    if not re.fullmatch(r'[a-z][a-z-]{1,31}', word):
        continue
    roots = sorted(set(wn._morphy(word, wn.NOUN) + wn._morphy(word, wn.VERB)))
    roots = [root_word for root_word in roots if root_word in dictionary]
    if roots:
        if word in dictionary or zipf_frequency(word, 'en', wordlist='large') >= 1:
            dictionary.add(word)
            if roots != [word]:
                forms[word] = roots
lexical = {}
for prompt in curated:
    # Only structural relations: synonyms, specific children, and components.
    related = {}
    for syn in wn.synsets(prompt):
        children = syn.hyponyms()
        grandchildren = [node for child in children for node in child.hyponyms()]
        for node in [syn] + children + grandchildren + syn.part_meronyms() + syn.substance_meronyms():
            for lemma in node.lemma_names():
                word = lemma.lower()
                if word in dictionary and word != prompt:
                    related[word] = f'Lexical relation: {node.definition()}'
    lexical[prompt] = related
freq = {w: zipf_frequency(w, 'en', wordlist='large') for w in sorted(dictionary)}
(root / 'data/words.json').write_text(json.dumps(freq, separators=(',', ':')))
(root / 'data/lexical.json').write_text(json.dumps(lexical, separators=(',', ':')))
(root / 'data/forms.json').write_text(json.dumps(forms, separators=(',', ':')))
(root / 'data/prompts.json').write_text(json.dumps(sorted(curated), indent=2))
print(f'{len(curated)} prompts, {len(dictionary)} dictionary words; offline Zipf values generated.')
for word in ['water','fish','coral','submarine','abyssal','bathymetry','petrichor','thaumaturgy']:
    print(word, freq.get(word))
