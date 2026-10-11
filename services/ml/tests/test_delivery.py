from datetime import UTC, datetime, timedelta

import numpy as np
import pytest

from unun_ml.catalogue import Order
from unun_ml.delivery import (
    DeliveryModel,
    evaluate,
    from_orders,
    pinball,
    rule_window,
    synthesize,
    traffic,
)


@pytest.fixture(scope="module")
def model() -> DeliveryModel:
    return DeliveryModel.train(synthesize(12_000, seed=1), trained_on="synthetic")


def order(**changes: float) -> dict[str, np.ndarray]:
    row = {"prep_minutes": 16, "km": 3.0, "hour": 15.0, "weekday": 1, "load": 1, "items": 2}
    return {name: np.array([float(value)]) for name, value in {**row, **changes}.items()}


def test_the_plain_rule_matches_the_one_in_the_api() -> None:
    # packages/core/src/delivery.ts: deliveryWindow(15, 3) is { min: 28, max: 36 }.
    low, high = rule_window(np.array([15.0]), np.array([3.0]))
    assert (low[0], high[0]) == (28, 36)
    # A short trip keeps a window of at least eight minutes.
    low, high = rule_window(np.array([5.0]), np.array([0.5]))
    assert high[0] - low[0] == 8


def test_invented_deliveries_are_the_same_for_the_same_seed() -> None:
    first, again = synthesize(500, seed=3), synthesize(500, seed=3)
    assert all(np.array_equal(first[name], again[name]) for name in first)
    assert not np.array_equal(first["minutes"], synthesize(500, seed=4)["minutes"])


def test_invented_deliveries_are_plausible() -> None:
    data = synthesize(5_000)
    assert data["minutes"].min() > 5
    assert 20 < np.median(data["minutes"]) < 60
    assert data["km"].min() >= 0.3 and data["km"].max() <= 9.0
    assert set(np.unique(data["weekday"])) == set(range(7))


def test_the_evening_rush_is_slower_than_the_small_hours() -> None:
    monday = np.array([0.0])
    assert traffic(np.array([18.75]), monday)[0] > traffic(np.array([15.0]), monday)[0]
    assert traffic(np.array([3.0]), monday)[0] < 1.0
    # Friday is the day off.
    assert traffic(np.array([18.75]), np.array([4.0]))[0] < traffic(np.array([18.75]), monday)[0]


def test_the_three_answers_never_cross(model: DeliveryModel) -> None:
    predicted = model.predict(synthesize(2_000, seed=9))
    assert np.all(predicted["p10"] <= predicted["p50"])
    assert np.all(predicted["p50"] <= predicted["p90"])


def test_further_and_slower_never_arrives_sooner(model: DeliveryModel) -> None:
    near, far = model.predict(order(km=1.0)), model.predict(order(km=7.0))
    assert far["p50"][0] > near["p50"][0]
    quick, slow = model.predict(order(prep_minutes=10)), model.predict(order(prep_minutes=30))
    assert slow["p50"][0] > quick["p50"][0]
    idle, busy = model.predict(order(load=0)), model.predict(order(load=8))
    assert busy["p50"][0] >= idle["p50"][0]


def test_the_rush_hour_is_predicted_slower(model: DeliveryModel) -> None:
    afternoon = model.predict(order(hour=15.5, km=6.0))
    evening = model.predict(order(hour=18.75, km=6.0))
    assert evening["p50"][0] > afternoon["p50"][0]


def test_beats_the_plain_rule_on_orders_it_has_not_seen(model: DeliveryModel) -> None:
    scores = evaluate(model, synthesize(6_000, seed=42))
    assert scores["model_mae"] < scores["rule_mae"]
    assert scores["model_late"] < scores["rule_late"]
    # The window is meant to hold eight orders in ten.
    assert 0.72 < scores["model_inside"] < 0.88


def test_pinball_loss_punishes_the_side_it_should() -> None:
    actual = np.array([10.0])
    # A p90 guess that is too low costs nine times what one equally too high costs.
    too_low = pinball(actual, np.array([8.0]), 0.9)
    too_high = pinball(actual, np.array([12.0]), 0.9)
    assert too_low == pytest.approx(9 * too_high)


def test_a_saved_model_answers_the_same(model: DeliveryModel, tmp_path) -> None:
    path = tmp_path / "model.joblib"
    model.save(path)
    loaded = DeliveryModel.load(path)
    assert loaded.version == model.version
    assert loaded.rows == model.rows
    assert np.allclose(model.predict(order())["p50"], loaded.predict(order())["p50"])
    assert path.with_suffix(".json").exists()


def test_orders_from_the_api_become_training_rows() -> None:
    noon = datetime(2026, 10, 11, 6, 0, tzinfo=UTC)  # Noon in Dhaka, a Sunday.

    def placed(minutes: int, kitchen: str, took: float | None) -> Order:
        return Order(kitchen, ("Tea",), 2, noon + timedelta(minutes=minutes), 12.0, 2.5, took)

    rows = from_orders(
        [
            placed(0, "a", 30.0),
            placed(20, "a", 34.0),
            placed(25, "b", 28.0),
            placed(30, "a", None),  # Not delivered: counts as load, not as a row.
            placed(40, "a", 41.0),
        ]
    )
    assert list(rows["minutes"]) == [30.0, 34.0, 28.0, 41.0]
    assert list(rows["hour"])[:2] == [12.0, 12.0 + 20 / 60]
    assert set(rows["weekday"]) == {6.0}
    # Orders the same kitchen took in the 45 minutes before each one.
    assert list(rows["load"]) == [0.0, 1.0, 0.0, 3.0]
