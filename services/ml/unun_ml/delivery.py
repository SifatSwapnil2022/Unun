"""How long a delivery takes, as a range.

The API promises an arrival window, not a minute. So the model predicts three numbers
for an order: the minutes that one delivery in ten beats (p10), the middle (p50), and
the minutes that only one in ten exceeds (p90). The window shown to the customer runs
from p10 to p90.

Each number comes from its own gradient-boosted model trained with the quantile loss,
which is what makes a model aim for "nine in ten are faster" rather than the average.

The training data here is synthetic. See `synthesize` for exactly what it assumes.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor

from .catalogue import Order

MODEL_DIR = Path(__file__).resolve().parent.parent / "models"
MODEL_FILE = MODEL_DIR / "delivery_time.joblib"

QUANTILES = (0.1, 0.5, 0.9)
FEATURES = ("prep_minutes", "km", "hour", "weekday", "load", "items")

# The plain rule in packages/core/src/delivery.ts, kept in step with it by a test.
MINUTES_PER_KM = 4.0
HANDOVER_MINUTES = 4.0

DHAKA = timedelta(hours=6)
LOAD_WINDOW = timedelta(minutes=45)


def rule_window(prep_minutes: np.ndarray, km: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """The arrival window the API uses when no model is running."""
    expected = prep_minutes + km * MINUTES_PER_KM + HANDOVER_MINUTES
    low = np.round(expected * 0.9)
    high = np.maximum(np.round(expected * 1.15), low + 8)
    return low, high


def traffic(hour: np.ndarray, weekday: np.ndarray) -> np.ndarray:
    """How much slower than a clear road a ride is, as a multiplier.

    An assumption, written down so it can be argued with: Dhaka's roads are slowest in
    the office rush of the morning and worst in the evening, a little slow at lunch,
    and clear late at night. Friday is the day off and the roads are emptier, except
    around the midday prayer. Saturday is half a working day.
    """

    def bump(centre: float, width: float, height: float) -> np.ndarray:
        return height * np.exp(-0.5 * ((hour - centre) / width) ** 2)

    slow = 1.0 + bump(9.0, 1.1, 0.35) + bump(13.5, 1.0, 0.15) + bump(18.75, 1.5, 0.55)
    slow -= 0.2 * ((hour >= 22.5) | (hour < 6.0))

    friday = weekday == 4
    saturday = weekday == 5
    slow = np.where(friday, 0.8 * slow + bump(13.25, 0.6, 0.2), slow)
    slow = np.where(saturday, 0.9 * slow, slow)
    return np.maximum(slow, 0.7)


def synthesize(rows: int, seed: int = 7) -> dict[str, np.ndarray]:
    """Invented deliveries, for want of real ones.

    Unun is a demo: no rider has ever carried an order across Dhaka for it. So the
    orders the model learns from are made up here, by a process meant to behave the
    way delivery does:

    - cooking takes the kitchen's usual time, longer for a big order and for a kitchen
      that already has orders on, with a spread that leans late;
    - a rider takes a few minutes to reach the kitchen, more at meal times;
    - the ride takes the distance times the traffic of that hour and day;
    - on about one day in seven it rains, which slows everything, and the model is
      never told about the rain, because the API does not know the weather either.

    None of this is measured. What is real is the method around it: the features, the
    quantile models, the comparison with the plain rule and the way the answer is used.
    Given real order events, the same code trains on those instead.
    """
    rng = np.random.default_rng(seed)

    # Orders cluster at lunch and dinner, with a tail at breakfast and late at night.
    meal = rng.choice(4, size=rows, p=[0.12, 0.36, 0.42, 0.10])
    centre = np.array([8.5, 13.2, 20.3, 23.3])[meal]
    width = np.array([1.0, 1.2, 1.5, 0.8])[meal]
    hour = np.mod(rng.normal(centre, width), 24.0)
    weekday = rng.integers(0, 7, size=rows)

    prep_minutes = rng.choice(
        [8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32],
        size=rows,
        p=[0.05, 0.08, 0.12, 0.13, 0.13, 0.12, 0.11, 0.09, 0.08, 0.05, 0.04],
    ).astype(float)
    km = np.round(np.clip(rng.gamma(2.2, 1.3, size=rows), 0.3, 9.0), 1)
    items = np.clip(rng.poisson(1.6, size=rows) + 1, 1, 12).astype(float)

    busy = np.exp(-0.5 * ((hour - 13.2) / 1.2) ** 2) + np.exp(-0.5 * ((hour - 20.3) / 1.5) ** 2)
    load = rng.poisson(0.6 + 3.2 * busy).astype(float)
    raining = rng.random(rows) < 0.15

    cooking = (
        prep_minutes
        * (0.82 + 0.06 * np.minimum(items, 8))
        * (1.0 + 0.07 * np.minimum(load, 8))
        * rng.lognormal(0.0, 0.16, size=rows)
    )
    rider = rng.gamma(2.0, 1.2 + 1.6 * busy) + np.where(raining, 3.0, 0.0)
    ride = (
        km
        * (MINUTES_PER_KM * 0.82)
        * traffic(hour, weekday)
        * np.where(raining, 1.28, 1.0)
        * rng.lognormal(0.0, 0.18, size=rows)
    )
    handover = 2.0 + rng.exponential(1.6, size=rows)

    # The rider often arrives while the food is still cooking, so the two overlap.
    minutes = np.maximum(cooking, rider) + 0.35 * np.minimum(cooking, rider) + ride + handover

    return {
        "prep_minutes": prep_minutes,
        "km": km,
        "hour": hour,
        "weekday": weekday.astype(float),
        "load": load,
        "items": items,
        "minutes": minutes,
    }


def from_orders(orders: list[Order] | tuple[Order, ...]) -> dict[str, np.ndarray]:
    """Delivered orders from the API, as the same columns `synthesize` makes."""
    delivered = sorted(
        (order for order in orders if order.minutes is not None),
        key=lambda order: order.placed_at,
    )
    everything = sorted(orders, key=lambda order: order.placed_at)

    load = []
    for order in delivered:
        since = order.placed_at - LOAD_WINDOW
        load.append(
            sum(
                1
                for other in everything
                if other.kitchen == order.kitchen and since <= other.placed_at < order.placed_at
            )
        )

    local = [order.placed_at.astimezone(UTC) + DHAKA for order in delivered]
    return {
        "prep_minutes": np.array([order.prep_minutes for order in delivered], dtype=float),
        "km": np.array([order.km for order in delivered], dtype=float),
        "hour": np.array([moment.hour + moment.minute / 60 for moment in local], dtype=float),
        "weekday": np.array([moment.weekday() for moment in local], dtype=float),
        "load": np.array(load, dtype=float),
        "items": np.array([order.items for order in delivered], dtype=float),
        "minutes": np.array([order.minutes for order in delivered], dtype=float),
    }


def matrix(columns: dict[str, np.ndarray]) -> np.ndarray:
    return np.column_stack([columns[name] for name in FEATURES])


def pinball(actual: np.ndarray, predicted: np.ndarray, quantile: float) -> float:
    """The loss a quantile model is trained on. Lower is better."""
    error = actual - predicted
    return float(np.mean(np.maximum(quantile * error, (quantile - 1) * error)))


@dataclass
class DeliveryModel:
    """Three models, one for each end of the window and one for the middle."""

    models: dict[float, HistGradientBoostingRegressor]
    version: str
    trained_on: str
    rows: int

    @classmethod
    def train(cls, columns: dict[str, np.ndarray], trained_on: str, seed: int = 7) -> DeliveryModel:
        features = matrix(columns)
        target = columns["minutes"]
        # Prediction must not fall when the distance or the cooking time rises. Telling
        # the model so keeps it from learning a dip out of noise.
        monotonic = [1, 1, 0, 0, 1, 1]

        models = {}
        for quantile in QUANTILES:
            model = HistGradientBoostingRegressor(
                loss="quantile",
                quantile=quantile,
                learning_rate=0.08,
                max_iter=260,
                max_leaf_nodes=24,
                min_samples_leaf=40,
                l2_regularization=0.5,
                monotonic_cst=monotonic,
                random_state=seed,
            )
            models[quantile] = model.fit(features, target)

        stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M")
        return cls(models=models, version=f"hgb-q-{stamp}", trained_on=trained_on, rows=len(target))

    def predict(self, columns: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
        """p10, p50 and p90 minutes for each row, never out of order."""
        features = matrix(columns)
        raw = np.column_stack([self.models[q].predict(features) for q in QUANTILES])
        # Three separate models can cross by a fraction of a minute. Sorting puts them right.
        ordered = np.sort(raw, axis=1)
        return {"p10": ordered[:, 0], "p50": ordered[:, 1], "p90": ordered[:, 2]}

    def save(self, path: Path = MODEL_FILE) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {"models": self.models, "version": self.version, "rows": self.rows,
             "trained_on": self.trained_on},
            path,
        )  # fmt: skip
        path.with_suffix(".json").write_text(
            json.dumps(
                {"version": self.version, "rows": self.rows, "trained_on": self.trained_on,
                 "features": FEATURES, "quantiles": QUANTILES},
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )  # fmt: skip

    @classmethod
    def load(cls, path: Path = MODEL_FILE) -> DeliveryModel:
        """Reads a model this service saved. The file is a pickle: only load your own."""
        stored = joblib.load(path)
        return cls(
            models=stored["models"],
            version=stored["version"],
            trained_on=stored["trained_on"],
            rows=stored["rows"],
        )


def evaluate(model: DeliveryModel, columns: dict[str, np.ndarray]) -> dict[str, float]:
    """How the model's window compares with the plain rule's, on orders it has not seen."""
    actual = columns["minutes"]
    predicted = model.predict(columns)
    low, high = rule_window(columns["prep_minutes"], columns["km"])
    rule_middle = (low + high) / 2

    def inside(lower: np.ndarray, upper: np.ndarray) -> float:
        return float(np.mean((actual >= lower) & (actual <= upper)))

    return {
        "rows": float(len(actual)),
        "model_mae": float(np.mean(np.abs(actual - predicted["p50"]))),
        "rule_mae": float(np.mean(np.abs(actual - rule_middle))),
        "model_inside": inside(predicted["p10"], predicted["p90"]),
        "rule_inside": inside(low, high),
        "model_late": float(np.mean(actual > predicted["p90"])),
        "rule_late": float(np.mean(actual > high)),
        "model_width": float(np.mean(predicted["p90"] - predicted["p10"])),
        "rule_width": float(np.mean(high - low)),
        "pinball_p10": pinball(actual, predicted["p10"], 0.1),
        "pinball_p50": pinball(actual, predicted["p50"], 0.5),
        "pinball_p90": pinball(actual, predicted["p90"], 0.9),
    }
