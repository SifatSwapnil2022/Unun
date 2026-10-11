"""The kitchens, their menus and their finished orders, as the API exports them.

A dish is known by its English name, which every kitchen that cooks it shares. Nothing
here says who ordered what: the export leaves people out.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@dataclass(frozen=True)
class Dish:
    name_en: str
    name_bn: str
    description_en: str = ""
    description_bn: str = ""


@dataclass(frozen=True)
class Kitchen:
    slug: str
    name_en: str
    name_bn: str
    tagline_en: str
    tagline_bn: str
    cuisines: tuple[tuple[str, str], ...]
    dishes: tuple[str, ...]
    popular: tuple[str, ...]


@dataclass(frozen=True)
class Order:
    kitchen: str
    dishes: tuple[str, ...]
    items: int
    placed_at: datetime
    prep_minutes: float
    km: float
    minutes: float | None


@dataclass(frozen=True)
class Catalogue:
    kitchens: tuple[Kitchen, ...]
    dishes: tuple[Dish, ...]
    orders: tuple[Order, ...] = field(default=())
    source: str = "file"

    def menu_of(self, slug: str) -> tuple[str, ...]:
        return next((k.dishes for k in self.kitchens if k.slug == slug), ())


def _parse(catalogue: dict[str, Any], orders: dict[str, Any], source: str) -> Catalogue:
    return Catalogue(
        kitchens=tuple(
            Kitchen(
                slug=k["slug"],
                name_en=k["name"]["en"],
                name_bn=k["name"]["bn"],
                tagline_en=k["tagline"]["en"],
                tagline_bn=k["tagline"]["bn"],
                cuisines=tuple((c["en"], c["bn"]) for c in k["cuisines"]),
                dishes=tuple(k["dishes"]),
                popular=tuple(k["popular"]),
            )
            for k in catalogue["kitchens"]
        ),
        dishes=tuple(
            Dish(
                name_en=d["name"]["en"],
                name_bn=d["name"]["bn"],
                description_en=d["description"]["en"],
                description_bn=d["description"]["bn"],
            )
            for d in catalogue["dishes"]
        ),
        orders=tuple(
            Order(
                kitchen=o["kitchen"],
                dishes=tuple(o["dishes"]),
                items=int(o["items"]),
                placed_at=datetime.fromisoformat(o["placedAt"].replace("Z", "+00:00")),
                prep_minutes=float(o["prepMinutes"]),
                km=float(o["km"]),
                minutes=None if o["minutes"] is None else float(o["minutes"]),
            )
            for o in orders["orders"]
        ),
        source=source,
    )


def load_from_files(directory: Path = DATA_DIR) -> Catalogue:
    """The demo data that ships with the service. `pnpm ml:export` rewrites it."""
    catalogue = json.loads((directory / "catalogue.json").read_text(encoding="utf-8"))
    orders = json.loads((directory / "orders.json").read_text(encoding="utf-8"))
    return _parse(catalogue, orders, "file")


def load_from_api(api_url: str, key: str, timeout: float = 5.0) -> Catalogue:
    """The live catalogue and orders, read from the API's internal addresses."""
    headers = {"x-internal-key": key}
    with httpx.Client(base_url=api_url, headers=headers, timeout=timeout) as client:
        catalogue = client.get("/internal/ml/catalogue").raise_for_status().json()
        orders = client.get("/internal/ml/orders").raise_for_status().json()
    return _parse(catalogue, orders, "api")


def load(api_url: str | None, key: str | None) -> Catalogue:
    """The API's data when it answers, the files that ship with the service when not."""
    if api_url and key:
        try:
            return load_from_api(api_url, key)
        except (httpx.HTTPError, KeyError, ValueError):
            pass
    return load_from_files()
