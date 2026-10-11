"""Search that survives spelling.

Every dish and every kitchen is turned into its phonetic key (see text.py) and cut into
overlapping groups of two to four letters. A query is cut the same way. A document is a
good match when it holds most of the query's letter groups, with rare groups counting
for more than common ones.

That is plain TF-IDF over character n-grams. It needs no training data, which matters:
there are no real search logs to train on. It is checked against a set of queries
written by hand, in evaluate.py.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer

from .catalogue import Catalogue
from .text import phonetic_key, skeleton, variants

# A document must hold this share of the query's letter groups to be shown. Chosen on
# half of the labelled queries and checked on the other half (see evaluate.py): high
# enough that "pizza" does not bring up "pitha", low enough that "fuska" finds fuchka.
THRESHOLD = 0.55

# How much each way of looking at a text counts: the spelling, the consonants word by
# word, and the consonants run together. See SearchIndex.
VIEW_WEIGHTS = (0.45, 0.35, 0.20)

# Two consonants are too few to tell words apart ("pizza" and "puja" share theirs), so
# a query that short is judged on its spelling alone.
SHORTEST_SKELETON = 3

# How much of a match on a dish's description counts, next to a match on its name.
DESCRIPTION_WEIGHT = 0.55

# A kitchen is shown with the dishes that matched nearly as well as its best one.
NEAR_BEST = 0.85
DISHES_SHOWN = 3


def _as_key(text: str) -> str:
    return phonetic_key(text)


def _as_skeleton(text: str) -> str:
    return skeleton(phonetic_key(text))


def _as_run(text: str) -> str:
    return skeleton(phonetic_key(text)).replace(" ", "")


@dataclass(frozen=True)
class KitchenHit:
    slug: str
    score: float
    dishes: tuple[str, ...]


@dataclass(frozen=True)
class DishHit:
    name: str
    score: float


class _View:
    """One way of cutting text into letter groups, and the documents cut that way."""

    def __init__(self, texts: list[str], analyzer: str) -> None:
        self._vectorizer = TfidfVectorizer(
            analyzer=analyzer, ngram_range=(2, 4), sublinear_tf=True, lowercase=False
        )
        self._vectorizer.fit(texts)
        self._analyse = self._vectorizer.build_analyzer()
        self._known = set(self._vectorizer.get_feature_names_out())
        # A rare letter group says more about what was meant than a common one.
        self._weights = np.square(self._vectorizer.idf_)
        self._usual_weight = float(np.median(self._weights))

    def presence(self, texts: list[str]) -> sparse.csr_matrix:
        """Which letter groups each text holds. How often does not matter."""
        matrix = self._vectorizer.transform(texts).tocsr()
        matrix.data[:] = 1.0
        return matrix

    def wanted(self, text: str) -> tuple[np.ndarray, float]:
        """The weight of each letter group in a query, and the weight of all of them.

        Groups the catalogue has never seen are in the total but can match nothing, so a
        query made mostly of them scores low against everything. That is how a search
        for something no kitchen sells comes back empty.
        """
        groups = self._vectorizer.transform([text])
        weights = np.zeros(groups.shape[1])
        weights[groups.indices] = self._weights[groups.indices]
        unseen = len(set(self._analyse(text)) - self._known)
        return weights, float(weights.sum()) + unseen * self._usual_weight


class SearchIndex:
    """Dishes and kitchens, ready to be searched.

    Each text is looked at three ways, and a match is judged on all three together:

    - the phonetic key, word by word: the exact spelling, give or take a letter;
    - its consonant skeleton, word by word: the same word with other vowels;
    - the skeleton with the spaces closed up: "chowmein" for "chow mein".
    """

    def __init__(self, catalogue: Catalogue) -> None:
        self._catalogue = catalogue
        self._dish_names = [dish.name_en for dish in catalogue.dishes]

        names = [f"{dish.name_en} {dish.name_bn}" for dish in catalogue.dishes]
        descriptions = [f"{dish.description_en} {dish.description_bn}" for dish in catalogue.dishes]
        kitchens = [
            " ".join(
                [kitchen.name_en, kitchen.name_bn]
                + [name for pair in kitchen.cuisines for name in pair]
            )
            for kitchen in catalogue.kitchens
        ]

        self._forms = (_as_key, _as_skeleton, _as_run)
        self._views = []
        self._names = []
        self._descriptions = []
        self._kitchens = []
        for form, analyzer in zip(self._forms, ("char_wb", "char_wb", "char"), strict=True):
            texts = [[form(text) for text in group] for group in (names, descriptions, kitchens)]
            view = _View([text for group in texts for text in group], analyzer)
            self._views.append(view)
            self._names.append(view.presence(texts[0]))
            self._descriptions.append(view.presence(texts[1]))
            self._kitchens.append(view.presence(texts[2]))

        position = {name: index for index, name in enumerate(self._dish_names)}
        self._menus = [
            np.array([position[name] for name in kitchen.dishes if name in position], dtype=int)
            for kitchen in catalogue.kitchens
        ]

    def _coverage(self, query: str) -> tuple[np.ndarray, np.ndarray]:
        """How much of the query each dish and each kitchen holds, from 0 to 1."""
        dishes = np.zeros(len(self._dish_names))
        kitchens = np.zeros(len(self._catalogue.kitchens))

        for variant in variants(query):
            if len(_as_key(variant)) < 2:
                continue

            by_name = np.zeros_like(dishes)
            by_description = np.zeros_like(dishes)
            by_kitchen = np.zeros_like(kitchens)
            counted = 0.0
            enough_consonants = len(_as_run(variant)) >= SHORTEST_SKELETON

            for index, (form, view) in enumerate(zip(self._forms, self._views, strict=True)):
                if index > 0 and not enough_consonants:
                    continue
                weights, total = view.wanted(form(variant))
                if total == 0:
                    continue
                share = VIEW_WEIGHTS[index]
                counted += share
                by_name += share * (self._names[index] @ weights) / total
                by_description += share * (self._descriptions[index] @ weights) / total
                by_kitchen += share * (self._kitchens[index] @ weights) / total
            if counted == 0:
                continue

            found = np.maximum(by_name, by_description * DESCRIPTION_WEIGHT) / counted
            dishes = np.maximum(dishes, found)
            kitchens = np.maximum(kitchens, by_kitchen / counted)

        return dishes, kitchens

    def dishes(self, query: str, limit: int = 10) -> list[DishHit]:
        """The dishes that match, best first."""
        scores, _ = self._coverage(query)
        order = np.argsort(-scores, kind="stable")[:limit]
        return [
            DishHit(self._dish_names[index], float(scores[index]))
            for index in order
            if scores[index] >= THRESHOLD
        ]

    def kitchens(self, query: str, limit: int = 60) -> list[KitchenHit]:
        """The kitchens to show for a query, best first.

        A kitchen matches by its own name or cuisine, or by a dish on its menu. Among
        kitchens that match equally well, the one with more matching dishes comes first.
        """
        dish_scores, kitchen_scores = self._coverage(query)
        hits: list[tuple[float, int, KitchenHit]] = []

        for index, kitchen in enumerate(self._catalogue.kitchens):
            menu = self._menus[index]
            on_menu = dish_scores[menu] if menu.size else np.zeros(0)
            best_dish = float(on_menu.max()) if on_menu.size else 0.0
            score = max(best_dish, float(kitchen_scores[index]))
            if score < THRESHOLD:
                continue

            matched = [
                (float(on_menu[i]), self._dish_names[menu[i]])
                for i in range(menu.size)
                if on_menu[i] >= max(THRESHOLD, best_dish * NEAR_BEST)
            ]
            matched.sort(key=lambda pair: -pair[0])
            names = tuple(name for _, name in matched[:DISHES_SHOWN])
            hits.append((score, len(matched), KitchenHit(kitchen.slug, score, names)))

        hits.sort(key=lambda hit: (-round(hit[0], 3), -hit[1], hit[2].slug))
        return [hit for _, _, hit in hits[:limit]]

    @property
    def size(self) -> dict[str, int]:
        return {"kitchens": len(self._catalogue.kitchens), "dishes": len(self._dish_names)}
