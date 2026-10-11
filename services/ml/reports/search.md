# Search: spelling, script and things nobody sells

Written by `python -m unun_ml.evaluate`. Do not edit by hand.

## Read this first

The 138 test searches in `data/search_queries.json` were written by hand
for this project. There are no real search logs. They cover the ways a dish name
goes wrong in Dhaka: another Latin spelling, a typo, Bangla script, the English word
for a Bangla dish, and food no kitchen here sells.

A search counts as right when a dish it was looking for is in the first three
results. For food that nobody sells, right means no results at all.

## The comparison

Half the searches were used to choose how close a match must be. 0.55 did
best there, and the code ships with 0.55. The table is the other half,
which that choice never saw.

| Kind of search | Searches | Letters as typed | This service |
| --- | --- | --- | --- |
| Spelled as on the menu | 12 | 12 | 12 |
| Another Latin spelling | 23 | 2 | 22 |
| A slip of the finger | 6 | 1 | 6 |
| Bangla script | 8 | 8 | 8 |
| The other language's word | 8 | 1 | 8 |
| Not sold by anyone | 12 | 12 | 11 |
| **All** | **69** | **36** | **67** |

"Letters as typed" is what the API does when this service is not running: it looks
for the typed letters anywhere in a name.

## What it still gets wrong

- `elish` brought up nothing.
- `steak` brought up Shutki bhorta.

## How it works

Each name is turned into a phonetic key, so that spellings of one word become the
same letters, and compared three ways: by its spelling, by its consonants, and by its
consonants with the spaces closed up. `unun_ml/text.py` and `unun_ml/search.py`
explain each step. Nothing is trained: with no search logs, there is nothing to train
on, and a method this small can be read and corrected by hand.
