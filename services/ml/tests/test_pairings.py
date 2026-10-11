import pytest

from unun_ml.catalogue import Catalogue
from unun_ml.pairings import Pairings

ORDERS = [
    ["kacchi", "borhani"],
    ["kacchi", "borhani", "firni"],
    ["kacchi", "borhani"],
    ["kacchi"],
    ["burger", "fries"],
    ["burger", "fries", "cola"],
    ["burger", "cola"],
    ["tea", "cola"],
    ["tea"],
]


@pytest.fixture
def model() -> Pairings:
    return Pairings(ORDERS)


def test_counts_each_order_once_and_each_dish_once_per_order() -> None:
    model = Pairings([["tea", "tea", "toast"], []])
    assert model.baskets == 1
    assert model.popularity("tea") == 1.0


def test_suggests_what_is_ordered_together(model: Pairings) -> None:
    menu = ["borhani", "firni", "fries", "cola", "tea"]
    assert model.suggest(["kacchi"], menu)[0] == "borhani"
    assert model.suggest(["burger"], menu)[0] == "fries"


def test_never_suggests_what_is_already_in_the_bag(model: Pairings) -> None:
    assert "borhani" not in model.suggest(["kacchi", "borhani"], ["borhani", "firni"])


def test_only_suggests_from_the_menu(model: Pairings) -> None:
    assert model.suggest(["kacchi"], ["fries"]) == []
    assert model.suggest(["kacchi"], []) == []


def test_a_dish_that_is_merely_popular_is_not_a_suggestion(model: Pairings) -> None:
    # Cola is in four orders of nine, but never beside a kacchi.
    assert "cola" not in model.suggest(["kacchi"], ["cola", "borhani"])


def test_knows_nothing_about_a_dish_it_has_never_seen(model: Pairings) -> None:
    assert model.suggest(["pizza"], ["borhani", "fries"]) == []


def test_keeps_the_limit(model: Pairings) -> None:
    assert len(model.suggest(["burger"], ["fries", "cola", "tea"], limit=1)) == 1


def test_similarity_is_one_for_itself_and_zero_for_strangers(model: Pairings) -> None:
    assert model.similarity("kacchi", "kacchi") == 1.0
    assert model.similarity("kacchi", "fries") == 0.0
    assert 0 < model.similarity("kacchi", "borhani") <= 1


def test_ranks_kitchens_by_what_the_customer_orders(model: Pairings) -> None:
    kitchens = [
        ("biryani-house", ["kacchi", "borhani", "firni"], ["kacchi"]),
        ("burger-bar", ["burger", "fries", "cola"], ["burger"]),
        ("tea-stall", ["tea"], ["tea"]),
    ]
    ranked = model.kitchens_for({"kacchi": 3, "borhani": 1}, kitchens)
    # The burger bar and the tea stall cook nothing this customer has shown a taste
    # for, so they score nothing and are left out.
    assert [slug for slug, _, _ in ranked] == ["biryani-house"]
    assert ranked[0][2] == "kacchi"


def test_no_history_means_no_kitchens(model: Pairings) -> None:
    assert model.kitchens_for({}, [("a", ["kacchi"], ["kacchi"])]) == []


def test_finds_the_demo_habits_without_being_told(catalogue: Catalogue) -> None:
    model = Pairings(order.dishes for order in catalogue.orders)
    everything = [dish.name_en for dish in catalogue.dishes]
    assert "Borhani" in model.suggest(["Mutton kacchi biryani"], everything)
    assert "French fries" in model.suggest(["Beef burger"], everything)
