"""Measures the three models and writes what it finds to reports/.

    python -m unun_ml.evaluate

Every number in the reports comes from running this file. Nothing in them is typed in.
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

import numpy as np
from sklearn.inspection import permutation_importance
from sklearn.linear_model import QuantileRegressor

from . import search as search_module
from .catalogue import DATA_DIR, Catalogue, load_from_files
from .delivery import (
    FEATURES,
    DeliveryModel,
    evaluate,
    matrix,
    rule_window,
    synthesize,
)
from .pairings import Pairings
from .search import SearchIndex

REPORTS = Path(__file__).resolve().parent.parent / "reports"

FEATURE_NAMES = {
    "prep_minutes": "Kitchen's cooking time",
    "km": "Distance",
    "hour": "Hour of the day",
    "weekday": "Day of the week",
    "load": "Orders the kitchen has on",
    "items": "Dishes in the order",
}

DAY_PARTS = (
    ("Morning rush, 8 to 10", 8.0, 10.0),
    ("Lunch, 12 to 3", 12.0, 15.0),
    ("Afternoon, 3 to 5", 15.0, 17.0),
    ("Evening rush, 5 to 9", 17.0, 21.0),
    ("Late, after 10", 22.0, 24.0),
)


def percent(share: float) -> str:
    return f"{share * 100:.0f}%"


# ---------------------------------------------------------------- arrival time


def _fitted_line(train: dict[str, np.ndarray], test: dict[str, np.ndarray]) -> dict[str, float]:
    """The plain rule with its numbers fitted to the data: cooking time and distance only.

    This separates two things the boosted model does: getting the size of the window
    right, which a line can also learn, and knowing about the hour and the kitchen's
    load, which it cannot.
    """
    rng = np.random.default_rng(3)
    sample = rng.choice(len(train["minutes"]), size=6000, replace=False)
    inputs = np.column_stack([train["prep_minutes"][sample], train["km"][sample]])
    outputs = train["minutes"][sample]
    held = np.column_stack([test["prep_minutes"], test["km"]])

    def fit(quantile: float) -> np.ndarray:
        line = QuantileRegressor(quantile=quantile, alpha=0.0, solver="highs")
        return line.fit(inputs, outputs).predict(held)

    low, middle, high = fit(0.1), fit(0.5), fit(0.9)
    actual = test["minutes"]
    return {
        "mae": float(np.mean(np.abs(actual - middle))),
        "inside": float(np.mean((actual >= low) & (actual <= high))),
        "late": float(np.mean(actual > high)),
        "width": float(np.mean(high - low)),
    }


def delivery_report() -> dict[str, object]:
    train = synthesize(60_000, seed=7)
    test = synthesize(20_000, seed=2026)
    model = DeliveryModel.train(train, trained_on="synthetic")
    scores = evaluate(model, test)
    line = _fitted_line(train, test)

    predicted = model.predict(test)
    low, high = rule_window(test["prep_minutes"], test["km"])
    by_part = []
    for name, start, end in DAY_PARTS:
        chosen = (test["hour"] >= start) & (test["hour"] < end)
        by_part.append(
            {
                "part": name,
                "orders": int(chosen.sum()),
                "rule_late": float(np.mean(test["minutes"][chosen] > high[chosen])),
                "model_late": float(np.mean(test["minutes"][chosen] > predicted["p90"][chosen])),
            }
        )

    sample = np.random.default_rng(5).choice(len(test["minutes"]), size=4000, replace=False)
    importance = permutation_importance(
        model.models[0.5],
        matrix(test)[sample],
        test["minutes"][sample],
        scoring="neg_mean_absolute_error",
        n_repeats=5,
        random_state=5,
    )
    features = sorted(
        zip(FEATURES, importance.importances_mean, strict=True), key=lambda pair: -pair[1]
    )

    rows = [
        ("The plain rule", scores["rule_mae"], scores["rule_inside"], scores["rule_late"],
         scores["rule_width"]),
        ("The rule's shape, fitted to the data", line["mae"], line["inside"], line["late"],
         line["width"]),
        ("Gradient boosting, all six inputs", scores["model_mae"], scores["model_inside"],
         scores["model_late"], scores["model_width"]),
    ]  # fmt: skip

    lines = [
        "# Arrival time: what the model adds",
        "",
        "Written by `python -m unun_ml.evaluate`. Do not edit by hand.",
        "",
        "## Read this first",
        "",
        "These numbers come from invented deliveries. Unun is a demo and has no real ones.",
        "`synthesize` in `unun_ml/delivery.py` makes the orders, and its assumptions about",
        "Dhaka traffic, busy kitchens and rain are written there in plain words. So the table",
        "shows that the method works on a world built to behave like delivery. It does not",
        "show how the model would do on real roads. That needs real order events, which the",
        "same code can be trained on.",
        "",
        "## The comparison",
        "",
        f"Trained on {len(train['minutes']):,} orders, measured on {len(test['minutes']):,} "
        "others the model never saw.",
        "",
        "| Method | Typical miss | Inside the window | Late | Window width |",
        "| --- | --- | --- | --- | --- |",
    ]
    lines += [
        f"| {name} | {mae:.1f} min | {percent(inside)} | {percent(late)} | {width:.1f} min |"
        for name, mae, inside, late, width in rows
    ]
    lines += [
        "",
        "- **Typical miss** is the average gap between the middle of the estimate and the real",
        "  arrival.",
        "- **Inside the window** is the share of orders that arrived between the two ends shown",
        "  to the customer. The model aims for 80%: one order in ten early, one in ten late.",
        "- **Late** is the share that arrived after the window closed. This is the number a",
        "  customer feels.",
        "",
        "The second row matters. It keeps the plain rule's two inputs and only fits its numbers,",
        "which already fixes most of the lateness, by making the window wider. The third row is",
        "what the hour, the day and the kitchen's load add on top: "
        f"a typical miss {line['mae'] - scores['model_mae']:.1f} minutes smaller, and a window",
        f"{line['width'] - scores['model_width']:.1f} minutes narrower for the same share of "
        "late orders.",
        "",
        "## Late orders by time of day",
        "",
        "A fixed rule is wrong in the same direction at the same hours. This is where the",
        "model earns its place.",
        "",
        "| When | Orders | Late with the plain rule | Late with the model |",
        "| --- | --- | --- | --- |",
    ]
    lines += [
        f"| {part['part']} | {part['orders']:,} | {percent(part['rule_late'])} | "
        f"{percent(part['model_late'])} |"
        for part in by_part
    ]
    lines += [
        "",
        "## What the model leans on",
        "",
        "How much worse the typical miss gets when one input is shuffled, so that the model",
        "can no longer use it.",
        "",
        "| Input | Minutes of accuracy lost without it |",
        "| --- | --- |",
    ]
    lines += [f"| {FEATURE_NAMES[name]} | {loss:.2f} |" for name, loss in features]
    lines += [
        "",
        "## How the API uses it",
        "",
        "The window shown to a customer runs from the model's fast end to its slow end. The",
        "API keeps that answer near the plain rule (see `toWindow` in",
        "`apps/api/src/modules/ml/eta.ts`) and falls back to the rule whenever this service",
        "is not running, is slow, or answers something that makes no sense.",
        "",
    ]
    (REPORTS / "delivery_time.md").write_text("\n".join(lines), encoding="utf-8")

    return {
        "scores": scores,
        "fitted_line": line,
        "by_day_part": by_part,
        "importance": {name: float(loss) for name, loss in features},
    }


# --------------------------------------------------------------------- search


def _relevant(names: list[str], expect: list[str]) -> set[str]:
    return {name for name in names if any(word in name.lower() for word in expect)}


def _as_typed(catalogue: Catalogue, query: str) -> list[str]:
    """What the API does without this service: the letters as typed, anywhere in a name."""
    typed = query.lower()
    return [
        dish.name_en
        for dish in catalogue.dishes
        if typed in dish.name_en.lower() or typed in dish.name_bn
    ]


def _right(found: list[str], wanted: set[str], kind: str) -> bool:
    if kind == "not-sold":
        return not found
    return any(name in wanted for name in found[:3])


def search_report() -> dict[str, object]:
    catalogue = load_from_files()
    index = SearchIndex(catalogue)
    names = [dish.name_en for dish in catalogue.dishes]
    stored = json.loads((DATA_DIR / "search_queries.json").read_text(encoding="utf-8"))
    queries = stored["queries"]

    # Every other query is set aside. The threshold is chosen on one half and the
    # scores are reported on the other, so the report is not marking its own homework.
    tuning, held_out = queries[0::2], queries[1::2]

    def score(group: list[dict], threshold: float) -> int:
        search_module.THRESHOLD = threshold
        return sum(
            _right(
                [hit.name for hit in index.dishes(query["query"], limit=3)],
                _relevant(names, query["expect"]),
                query["kind"],
            )
            for query in group
        )

    shipped = search_module.THRESHOLD
    tried = [round(value, 2) for value in np.arange(0.40, 0.76, 0.05)]
    by_threshold = {threshold: score(tuning, threshold) for threshold in tried}
    best = max(by_threshold.values())
    # Of the thresholds that do best, the middle one: the furthest from either edge.
    winners = [threshold for threshold in tried if by_threshold[threshold] == best]
    chosen = winners[len(winners) // 2]
    search_module.THRESHOLD = chosen

    kinds: dict[str, dict[str, int]] = defaultdict(lambda: {"n": 0, "model": 0, "typed": 0})
    misses = []
    for query in held_out:
        wanted = _relevant(names, query["expect"])
        found = [hit.name for hit in index.dishes(query["query"], limit=3)]
        row = kinds[query["kind"]]
        row["n"] += 1
        row["typed"] += _right(_as_typed(catalogue, query["query"]), wanted, query["kind"])
        if _right(found, wanted, query["kind"]):
            row["model"] += 1
        else:
            misses.append((query["query"], found[0] if found else "nothing"))
    search_module.THRESHOLD = shipped

    labels = {
        "exact": "Spelled as on the menu",
        "spelling": "Another Latin spelling",
        "typo": "A slip of the finger",
        "bangla": "Bangla script",
        "other-language": "The other language's word",
        "not-sold": "Not sold by anyone",
    }
    total = {key: sum(row[key] for row in kinds.values()) for key in ("n", "model", "typed")}

    lines = [
        "# Search: spelling, script and things nobody sells",
        "",
        "Written by `python -m unun_ml.evaluate`. Do not edit by hand.",
        "",
        "## Read this first",
        "",
        f"The {len(queries)} test searches in `data/search_queries.json` were written by hand",
        "for this project. There are no real search logs. They cover the ways a dish name",
        "goes wrong in Dhaka: another Latin spelling, a typo, Bangla script, the English word",
        "for a Bangla dish, and food no kitchen here sells.",
        "",
        "A search counts as right when a dish it was looking for is in the first three",
        "results. For food that nobody sells, right means no results at all.",
        "",
        "## The comparison",
        "",
        f"Half the searches were used to choose how close a match must be. {chosen:.2f} did",
        f"best there, and the code ships with {shipped:.2f}. The table is the other half,",
        "which that choice never saw.",
        "",
        "| Kind of search | Searches | Letters as typed | This service |",
        "| --- | --- | --- | --- |",
    ]
    lines += [
        f"| {labels[kind]} | {row['n']} | {row['typed']} | {row['model']} |"
        for kind, row in ((kind, kinds[kind]) for kind in labels if kind in kinds)
    ]
    lines += [
        f"| **All** | **{total['n']}** | **{total['typed']}** | **{total['model']}** |",
        "",
        '"Letters as typed" is what the API does when this service is not running: it looks',
        "for the typed letters anywhere in a name.",
        "",
        "## What it still gets wrong",
        "",
    ]
    lines += (
        [f"- `{query}` brought up {found}." for query, found in misses]
        if misses
        else ["Nothing in the held-out half."]
    )
    lines += [
        "",
        "## How it works",
        "",
        "Each name is turned into a phonetic key, so that spellings of one word become the",
        "same letters, and compared three ways: by its spelling, by its consonants, and by its",
        "consonants with the spaces closed up. `unun_ml/text.py` and `unun_ml/search.py`",
        "explain each step. Nothing is trained: with no search logs, there is nothing to train",
        "on, and a method this small can be read and corrected by hand.",
        "",
    ]
    (REPORTS / "search.md").write_text("\n".join(lines), encoding="utf-8")

    return {
        "threshold_chosen_on_tuning_half": chosen,
        "threshold_shipped": shipped,
        "tuning_scores": {str(key): value for key, value in by_threshold.items()},
        "held_out": {kind: dict(row) for kind, row in kinds.items()},
        "misses": misses,
    }


# ------------------------------------------------------------------- pairings


def pairings_report() -> dict[str, object]:
    catalogue = load_from_files()
    orders = sorted(catalogue.orders, key=lambda order: order.placed_at)
    cut = int(len(orders) * 0.8)
    earlier, later = orders[:cut], orders[cut:]
    model = Pairings(order.dishes for order in earlier)

    tried = hits = popular_hits = 0
    chance = 0.0
    for order in later:
        menu = catalogue.menu_of(order.kitchen)
        if len(order.dishes) < 2 or not menu:
            continue
        # Hide each dish in turn and see whether the rest of the order brings it back.
        for hidden in order.dishes:
            rest = [dish for dish in order.dishes if dish != hidden]
            choices = [dish for dish in menu if dish not in rest]
            if hidden not in choices:
                continue
            tried += 1
            hits += hidden in model.suggest(rest, choices, limit=3)
            by_popularity = sorted(choices, key=lambda dish: (-model.popularity(dish), dish))
            popular_hits += hidden in by_popularity[:3]
            chance += min(3, len(choices)) / len(choices)

    examples = []
    for dish in ("Mutton kacchi biryani", "Beef burger", "Milk tea", "Fuchka, 8 pieces"):
        everything = [other.name_en for other in catalogue.dishes]
        examples.append((dish, model.suggest([dish], everything, limit=3)))

    def share(count: float) -> str:
        return percent(count / tried) if tried else "n/a"

    lines = [
        "# Goes well with: what the order history gives back",
        "",
        "Written by `python -m unun_ml.evaluate`. Do not edit by hand.",
        "",
        "## Read this first",
        "",
        "The order history is demo data. The seed makes most orders follow ordinary habits",
        "(a borhani with a kacchi, fries with a burger; see `apps/api/src/seed/pairings.ts`)",
        "and leaves the rest to chance. The model is never shown those habits. It is given the",
        "orders and has to find them. So this report shows that it can find a pattern that is",
        "there. On real orders it would find whatever real customers do.",
        "",
        "## The test",
        "",
        f"The model learned from the first {len(earlier)} orders. For each later order with two",
        "or more dishes, one dish was hidden, and the model was asked what goes with the",
        "rest. It is right when the hidden dish is among its three suggestions.",
        "",
        "| Method | Hidden dish found in three suggestions |",
        "| --- | --- |",
        f"| Three dishes from the menu at random | {share(chance)} |",
        f"| The three most ordered dishes on the menu | {share(popular_hits)} |",
        f"| Dishes ordered together (this model) | {share(hits)} |",
        "",
        f"{tried} hidden dishes from {len(later)} orders.",
        "",
        "## What it learned",
        "",
        "| In the bag | It suggests |",
        "| --- | --- |",
    ]
    lines += [f"| {dish} | {', '.join(found) or 'nothing'} |" for dish, found in examples]
    lines += [
        "",
        "## Kitchens for a customer",
        "",
        "The same counts rank kitchens for a signed-in customer: a kitchen scores for cooking",
        "what they have ordered, and what people who order those dishes also order. That",
        "ranking is not measured here. Measuring it needs customers who come back, and the",
        "demo has none.",
        "",
    ]
    (REPORTS / "pairings.md").write_text("\n".join(lines), encoding="utf-8")

    return {
        "learned_from": len(earlier),
        "tested_on": len(later),
        "hidden_dishes": tried,
        "found_by_model": hits,
        "found_by_popularity": popular_hits,
        "found_by_chance": round(chance, 1),
    }


def main() -> None:
    REPORTS.mkdir(exist_ok=True)
    results = {
        "delivery_time": delivery_report(),
        "search": search_report(),
        "pairings": pairings_report(),
    }
    (REPORTS / "metrics.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    for name in ("delivery_time.md", "search.md", "pairings.md", "metrics.json"):
        print(f"wrote reports/{name}")


if __name__ == "__main__":
    main()
