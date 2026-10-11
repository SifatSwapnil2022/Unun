"""Trains the arrival-time model and saves it.

    python -m unun_ml.train                 on invented deliveries (the default)
    python -m unun_ml.train --source api    on delivered orders read from the Unun API

The API's own demo orders are placed by a simulator that follows the plain rule, so a
model trained on them learns the rule back. `--source api` is there for the day the
orders are real.
"""

from __future__ import annotations

import argparse

from . import catalogue
from .config import load as load_settings
from .delivery import MODEL_FILE, DeliveryModel, evaluate, from_orders, synthesize

# Below this many delivered orders, a model would be memorising rather than learning.
FEWEST_REAL_ORDERS = 2000


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", choices=("synthetic", "api"), default="synthetic")
    parser.add_argument("--rows", type=int, default=60_000)
    arguments = parser.parse_args()

    if arguments.source == "api":
        settings = load_settings()
        if not settings.api_url or not settings.internal_key:
            raise SystemExit("Set UNUN_API_URL and INTERNAL_KEY to train on the API's orders.")
        loaded = catalogue.load_from_api(settings.api_url, settings.internal_key)
        columns = from_orders(loaded.orders)
        if len(columns["minutes"]) < FEWEST_REAL_ORDERS:
            raise SystemExit(
                f"The API has {len(columns['minutes'])} delivered orders. "
                f"At least {FEWEST_REAL_ORDERS} are needed to train on them."
            )
        held_out = {name: values[-len(values) // 5 :] for name, values in columns.items()}
        columns = {name: values[: -len(values) // 5] for name, values in columns.items()}
    else:
        columns = synthesize(arguments.rows, seed=7)
        held_out = synthesize(arguments.rows // 4, seed=2026)

    model = DeliveryModel.train(columns, trained_on=arguments.source)
    model.save()
    scores = evaluate(model, held_out)

    print(f"Saved {model.version} to {MODEL_FILE}")
    print(f"Trained on {model.rows:,} orders, checked on {int(scores['rows']):,} others.")
    print(
        f"Inside the window: {scores['model_inside']:.0%} "
        f"(the plain rule: {scores['rule_inside']:.0%}). "
        f"Late: {scores['model_late']:.0%} (the plain rule: {scores['rule_late']:.0%})."
    )


if __name__ == "__main__":
    main()
