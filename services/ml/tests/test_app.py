import pytest
from fastapi.testclient import TestClient

from unun_ml import app as service
from unun_ml.delivery import DeliveryModel, synthesize


@pytest.fixture(scope="module")
def client() -> TestClient:
    # The service is used as an object here, without its start-up work: no call to the
    # API, and a small model made on the spot instead of the saved one.
    service.engine.delivery = DeliveryModel.train(synthesize(4_000, seed=2), "synthetic")
    return TestClient(service.app)


ORDER = {"prep_minutes": 16, "km": 3.2, "hour": 13.5, "weekday": 6, "load": 2, "items": 3}


def test_health_says_what_is_loaded(client: TestClient) -> None:
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["delivery"]["ready"] is True
    assert body["delivery"]["trainedOn"] == "synthetic"
    assert body["search"]["dishes"] > 100
    assert body["pairings"]["baskets"] > 100
    assert body["catalogue"]["source"] == "file"


def test_predicts_a_window_for_each_order_in_turn(client: TestClient) -> None:
    far = {**ORDER, "km": 8.0}
    answer = client.post("/v1/delivery-time", json={"orders": [ORDER, far]})
    assert answer.status_code == 200
    near_window, far_window = answer.json()["predictions"]
    assert near_window["p10"] <= near_window["p50"] <= near_window["p90"]
    assert far_window["p50"] > near_window["p50"]


@pytest.mark.parametrize(
    "change",
    [{"km": -1}, {"km": 400}, {"hour": 24}, {"weekday": 7}, {"prep_minutes": 0}, {"items": 0}],
)
def test_refuses_an_order_that_cannot_be(client: TestClient, change: dict) -> None:
    answer = client.post("/v1/delivery-time", json={"orders": [{**ORDER, **change}]})
    assert answer.status_code == 422


def test_refuses_no_orders_and_too_many(client: TestClient) -> None:
    assert client.post("/v1/delivery-time", json={"orders": []}).status_code == 422
    assert client.post("/v1/delivery-time", json={"orders": [ORDER] * 501}).status_code == 422


def test_says_so_while_the_model_is_not_ready(client: TestClient) -> None:
    model, service.engine.delivery = service.engine.delivery, None
    try:
        assert client.post("/v1/delivery-time", json={"orders": [ORDER]}).status_code == 503
        assert client.get("/health").json()["delivery"]["ready"] is False
    finally:
        service.engine.delivery = model


def test_search_finds_kitchens_with_the_dishes_that_matched(client: TestClient) -> None:
    body = client.get("/v1/search", params={"q": "kachi biriani", "limit": 5}).json()
    assert 0 < len(body["kitchens"]) <= 5
    assert any("kacchi" in dish.lower() for dish in body["kitchens"][0]["dishes"])
    assert client.get("/v1/search", params={"q": "sushi"}).json()["kitchens"] == []


def test_search_needs_something_to_search_for(client: TestClient) -> None:
    assert client.get("/v1/search").status_code == 422
    assert client.get("/v1/search", params={"q": ""}).status_code == 422
    assert client.get("/v1/search", params={"q": "x" * 81}).status_code == 422


def test_pairings_come_from_the_menu_given(client: TestClient) -> None:
    menu = ["Borhani", "Firni", "French fries"]
    body = client.post(
        "/v1/pairings", json={"basket": ["Mutton kacchi biryani"], "menu": menu, "limit": 2}
    ).json()
    assert body["dishes"][0] == "Borhani"
    assert len(body["dishes"]) <= 2
    assert set(body["dishes"]) <= set(menu)


def test_kitchens_for_a_customer_leave_out_the_ones_they_know(client: TestClient) -> None:
    history = [{"dish": "Mutton kacchi biryani", "count": 4}, {"dish": "Borhani", "count": 2}]
    body = client.post("/v1/kitchens-for", json={"history": history, "limit": 5}).json()
    slugs = [kitchen["slug"] for kitchen in body["kitchens"]]
    assert 0 < len(slugs) <= 5
    assert body["kitchens"][0]["because"] in {"Mutton kacchi biryani", "Borhani"}

    without = client.post(
        "/v1/kitchens-for", json={"history": history, "exclude": slugs[:2], "limit": 5}
    ).json()
    assert not set(slugs[:2]) & {kitchen["slug"] for kitchen in without["kitchens"]}
