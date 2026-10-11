# Unun's learning service

A small Python service that the Unun API asks three questions:

| Question                                | Address                                      | How it answers                                                                       |
| --------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| When will this order arrive?            | `POST /v1/delivery-time`                     | Three gradient-boosted models, one for each end of the window and one for the middle |
| Which kitchens match what was typed?    | `GET /v1/search`                             | Spellings folded to one key, then compared by groups of letters                      |
| What goes with this bag, or this taste? | `POST /v1/pairings`, `POST /v1/kitchens-for` | Counts of dishes ordered together                                                    |

`GET /health` says what is loaded.

The service is an extra. The API gives it 700 milliseconds, and treats a slow answer, a
failed one or one that makes no sense as no answer. It then uses its own plain rule,
and customers can still order.

## Read this before the numbers

Unun is a demo. It has no real deliveries, no real search logs and no returning
customers, so nothing here was learned from real behaviour:

- The arrival-time model is trained on **invented deliveries**. `synthesize` in
  [`unun_ml/delivery.py`](unun_ml/delivery.py) makes them, and says in plain words what
  it assumes about traffic, busy kitchens and rain.
- Search is measured on **138 queries written by hand** for this project.
- Suggestions are learned from the **demo order history**, which the seed makes follow
  ordinary habits.

What is real is the method: how the data becomes features, which model and why, how it
is measured against the simple thing it replaces, and how the answer is guarded before
a customer sees it. Each report says what it does and does not show:

- [Arrival time](reports/delivery_time.md)
- [Search](reports/search.md)
- [Goes well with](reports/pairings.md)

Every number in them is written by `pnpm ml:evaluate`. Nothing is typed in.

## Run it

From the repository root, with Python 3.11 or newer installed:

```bash
pnpm ml:setup      # once: environment, packages, and a trained model
pnpm dev           # starts it with the API and the site
```

Or by itself, from this folder:

```bash
python -m venv .venv
.venv/bin/pip install -r requirements-dev.txt      # .venv\Scripts\pip on Windows
.venv/bin/python -m unun_ml.train
.venv/bin/uvicorn unun_ml.app:app --port 8000
```

| Command            | What it does                                                |
| ------------------ | ----------------------------------------------------------- |
| `pnpm ml:test`     | Runs the tests                                              |
| `pnpm ml:evaluate` | Measures all three and rewrites `reports/`                  |
| `pnpm ml:train`    | Trains the arrival-time model again                         |
| `pnpm ml:export`   | Rewrites `data/` from the demo seed. Needs Node, not Python |

### Settings

| Setting           | Default                 | Meaning                                                |
| ----------------- | ----------------------- | ------------------------------------------------------ |
| `UNUN_API_URL`    | `http://127.0.0.1:4000` | Where to read menus and finished orders from           |
| `INTERNAL_KEY`    | the API's dev key       | What the API asks for on those addresses               |
| `TRAINING_ROWS`   | `60000`                 | Invented deliveries to learn from if no model is saved |
| `REFRESH_MINUTES` | `10`                    | How often to look for a changed menu or new orders     |

When the API does not answer, the service runs on the demo data in `data/`.

## How each part works

### Arrival time

The API promises a window, not a minute. So the model predicts three numbers: the
minutes one delivery in ten beats, the middle, and the minutes only one in ten exceeds.
Each comes from its own `HistGradientBoostingRegressor` trained with the quantile loss.
The inputs are the kitchen's cooking time, the distance, the hour, the day of the week,
how many orders the kitchen has on, and how many dishes are in this one. The models are
told that more distance, more cooking, more load and more dishes can never mean sooner.

The API turns the two ends into the window it shows, and keeps them near its own plain
rule: never below 60% of the rule's earliest minute or above 180% of its latest, and
never narrower than six minutes. See `toWindow` in `apps/api/src/modules/ml/eta.ts`.

`python -m unun_ml.train --source api` trains on delivered orders read from the API
instead. It refuses below 2,000 orders. The demo's own orders are placed by a simulator
that follows the plain rule, so a model trained on them would learn the rule back.

### Search

[`unun_ml/text.py`](unun_ml/text.py) does two things to every name and every query.
It writes Bangla script in Latin letters, sound by sound. Then it folds the Latin
spellings that sound alike: `kacchi`, `kachchi`, `kachi` and `কাচ্চি` all become `kaci`.

[`unun_ml/search.py`](unun_ml/search.py) cuts that key into overlapping groups of two
to four letters and asks how much of the query each dish holds. It looks three ways and
weighs them together: the spelling, the consonants alone (`nehari` and `nihari` are
both `nhr`), and the consonants with the spaces closed (`chowmein` for `chow mein`).
A short hand-written list covers words that are simply different, like `hilsa` for
`ilish`.

Nothing is trained. With no search logs there is nothing to train on, and a method
this small can be read and corrected by hand.

### Suggestions

[`unun_ml/pairings.py`](unun_ml/pairings.py) counts how often each pair of dishes was
in the same order. A dish is suggested when the bag makes it more likely than it is
anyway, so a drink that is in every third order is not offered with everything. Thin
counts are pulled towards each dish's overall popularity.

The same counts rank kitchens for a signed-in customer. The API sends only the names of
the dishes they have ordered, never who they are.

## What it does not do

- It has not seen real data of any kind.
- It keeps its counts and its index in memory and rebuilds them every ten minutes. That
  is right for 69 kitchens and wrong for 69,000.
- The saved model is a pickle, which only loads under the scikit-learn version that
  wrote it. It is made on each machine and not committed.
- The service has no sign-in. It listens on `127.0.0.1` and is meant to be reached only
  by the API on the same machine.
- Kitchen picks for a customer are not measured. That needs customers who come back.
