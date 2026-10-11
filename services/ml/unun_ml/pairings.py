"""What goes with what, learned from finished orders.

For every pair of dishes this counts how often they were in the same order. A dish is
suggested when it turns up beside the dishes in the bag more often than it turns up in
general. With few orders the counts are noisy, so each estimate is pulled towards the
dish's overall popularity until there is enough evidence to move it.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable, Sequence
from itertools import combinations
from math import sqrt

# How many orders' worth of doubt each pair starts with. Higher trusts the counts less.
PRIOR_STRENGTH = 4.0

# In a kitchen's score, a dish it is known for counts in full and the rest in part.
KNOWN_FOR = 1.0
ALSO_ON_MENU = 0.35


class Pairings:
    """Counts of dishes ordered together."""

    def __init__(self, baskets: Iterable[Sequence[str]]) -> None:
        self.baskets = 0
        self._alone: Counter[str] = Counter()
        self._together: Counter[tuple[str, str]] = Counter()

        for basket in baskets:
            dishes = sorted(set(basket))
            if not dishes:
                continue
            self.baskets += 1
            self._alone.update(dishes)
            self._together.update(combinations(dishes, 2))

    def _pair(self, a: str, b: str) -> int:
        return self._together[(a, b) if a < b else (b, a)]

    def popularity(self, dish: str) -> float:
        """The share of all orders that held the dish."""
        return self._alone[dish] / self.baskets if self.baskets else 0.0

    def given(self, dish: str, held: str) -> float:
        """How likely `dish` is in an order that holds `held`, with the prior mixed in."""
        seen = self._alone[held]
        prior = self.popularity(dish)
        return (self._pair(dish, held) + PRIOR_STRENGTH * prior) / (seen + PRIOR_STRENGTH)

    def similarity(self, a: str, b: str) -> float:
        """How alike two dishes are in the company they keep: 1 for the same dish."""
        if a == b:
            return 1.0
        together = self._pair(a, b)
        if together == 0:
            return 0.0
        return together / sqrt(self._alone[a] * self._alone[b])

    def suggest(self, basket: Sequence[str], menu: Sequence[str], limit: int = 3) -> list[str]:
        """Dishes from `menu` that go with `basket`, best first.

        A dish is only suggested if the bag makes it more likely than it is anyway.
        A drink that is in every third order is not a suggestion for anything.
        """
        held = [dish for dish in dict.fromkeys(basket) if self._alone[dish] > 0]
        if not held:
            return []

        scored = []
        for dish in dict.fromkeys(menu):
            if dish in basket:
                continue
            lift = sum(self.given(dish, other) for other in held) / len(held)
            gain = lift - self.popularity(dish)
            if gain > 0:
                scored.append((gain, dish))

        scored.sort(key=lambda pair: (-pair[0], pair[1]))
        return [dish for _, dish in scored[:limit]]

    def kitchens_for(
        self,
        history: dict[str, int],
        kitchens: Iterable[tuple[str, Sequence[str], Sequence[str]]],
        limit: int = 12,
    ) -> list[tuple[str, float, str | None]]:
        """Kitchens for someone with this order history, best first.

        `kitchens` yields (slug, menu, dishes the kitchen is known for). A kitchen
        scores for cooking what the customer has ordered before, and for cooking what
        people who order those dishes also order. Each result comes with the dish from
        the history that counted most towards it.
        """
        total = sum(history.values())
        if total == 0:
            return []
        taste = {dish: count / total for dish, count in history.items()}

        results = []
        for slug, menu, popular in kitchens:
            if not menu:
                continue
            credit: Counter[str] = Counter()
            for dish in menu:
                weight = KNOWN_FOR if dish in popular else ALSO_ON_MENU
                for liked, share in taste.items():
                    credit[liked] += weight * share * self.similarity(liked, dish)

            score = sum(credit.values()) / sqrt(len(menu))
            if score > 0:
                because = max(credit.items(), key=lambda pair: (pair[1], pair[0]))[0]
                results.append((slug, score, because))

        results.sort(key=lambda result: (-result[1], result[0]))
        return results[:limit]
