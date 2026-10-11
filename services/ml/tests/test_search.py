import pytest

from unun_ml.catalogue import Catalogue
from unun_ml.search import THRESHOLD, SearchIndex


@pytest.fixture(scope="module")
def index(catalogue: Catalogue) -> SearchIndex:
    return SearchIndex(catalogue)


def first_dish(index: SearchIndex, query: str) -> str:
    hits = index.dishes(query, limit=1)
    return hits[0].name if hits else ""


@pytest.mark.parametrize(
    ("query", "part_of_name"),
    [
        ("kacchi", "kacchi"),
        ("kachchi", "kacchi"),
        ("কাচ্চি", "kacchi"),
        ("biriyani", "biryani"),
        ("phuchka", "Fuchka"),
        ("fuska", "uchka"),
        ("vorta", "bhorta"),
        ("nihari", "nehari"),
        ("barger", "urger"),
        ("chowmein", "chow mein"),
        ("দুধ চা", "Milk tea"),
        ("dudh cha", "Milk tea"),
        ("hilsa", "ilish"),
        ("jalebi", "Jilapi"),
    ],
)
def test_a_dish_is_found_however_it_is_spelled(
    index: SearchIndex, query: str, part_of_name: str
) -> None:
    assert part_of_name.lower() in first_dish(index, query).lower()


@pytest.mark.parametrize("query", ["pizza", "sushi", "ramen", "asdfgh", "??", " "])
def test_what_nobody_sells_finds_nothing(index: SearchIndex, query: str) -> None:
    assert index.dishes(query) == []
    assert index.kitchens(query) == []


def test_every_result_clears_the_threshold_and_comes_best_first(index: SearchIndex) -> None:
    hits = index.dishes("biryani", limit=20)
    assert hits
    scores = [hit.score for hit in hits]
    assert scores == sorted(scores, reverse=True)
    assert min(scores) >= THRESHOLD


def test_kitchens_come_with_the_dishes_that_matched(
    index: SearchIndex, catalogue: Catalogue
) -> None:
    hits = index.kitchens("kachi biriani")
    assert hits
    for hit in hits[:5]:
        assert hit.dishes, hit.slug
        menu = catalogue.menu_of(hit.slug)
        assert all(dish in menu for dish in hit.dishes)
        assert len(hit.dishes) <= 3
    assert any("kacchi" in dish.lower() for dish in hits[0].dishes)


def test_a_kitchen_is_found_by_its_own_name(index: SearchIndex) -> None:
    assert index.kitchens("dum ghor")[0].slug == "dum-ghor"
    assert index.kitchens("দম ঘর")[0].slug == "dum-ghor"


def test_the_limit_is_kept(index: SearchIndex) -> None:
    assert len(index.kitchens("chicken", limit=4)) == 4


def test_size_counts_what_was_indexed(index: SearchIndex, catalogue: Catalogue) -> None:
    assert index.size == {
        "kitchens": len(catalogue.kitchens),
        "dishes": len(catalogue.dishes),
    }
