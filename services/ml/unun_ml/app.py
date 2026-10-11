"""The service's HTTP face. Run it with:  uvicorn unun_ml.app:app --port 8000

It is meant to be called by the Unun API on the same machine, not by browsers, so it
listens on 127.0.0.1 unless told otherwise and has no sign-in of its own. Nothing it
returns is private: its answers are built from the public menu and from orders with the
people taken out.
"""

from __future__ import annotations

import asyncio
import contextlib
import threading
from collections.abc import AsyncIterator

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from . import __version__
from .config import load as load_settings
from .engine import Engine

settings = load_settings()
engine = Engine(settings)


async def _keep_fresh() -> None:
    """Looks at the API for a changed menu or new orders, now and every few minutes."""
    while True:
        with contextlib.suppress(Exception):
            await asyncio.to_thread(engine.refresh)
        await asyncio.sleep(settings.refresh_minutes * 60)


@contextlib.asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    threading.Thread(target=engine.ready_delivery, daemon=True).start()
    refresher = asyncio.create_task(_keep_fresh())
    yield
    refresher.cancel()


app = FastAPI(title="Unun ML", version=__version__, lifespan=lifespan)


class DeliveryOrder(BaseModel):
    prep_minutes: float = Field(gt=0, le=180)
    km: float = Field(ge=0, le=30)
    hour: float = Field(ge=0, lt=24)
    weekday: int = Field(ge=0, le=6)
    load: float = Field(ge=0, le=200)
    items: float = Field(ge=1, le=200)


class DeliveryRequest(BaseModel):
    orders: list[DeliveryOrder] = Field(min_length=1, max_length=500)


class PairingsRequest(BaseModel):
    basket: list[str] = Field(min_length=1, max_length=60)
    menu: list[str] = Field(max_length=400)
    limit: int = Field(default=3, ge=1, le=10)


class HistoryLine(BaseModel):
    dish: str = Field(max_length=200)
    count: int = Field(ge=1, le=10_000)


class KitchensForRequest(BaseModel):
    history: list[HistoryLine] = Field(min_length=1, max_length=400)
    exclude: list[str] = Field(default_factory=list, max_length=400)
    limit: int = Field(default=12, ge=1, le=60)


@app.get("/health")
def health() -> dict[str, object]:
    loaded = engine.loaded
    model = engine.delivery
    return {
        "status": "ok",
        "version": __version__,
        "delivery": {
            "ready": model is not None,
            "version": model.version if model else None,
            "trainedOn": model.trained_on if model else None,
        },
        "search": loaded.search.size,
        "pairings": {"baskets": loaded.pairings.baskets},
        "catalogue": {"source": loaded.catalogue.source},
    }


@app.post("/v1/delivery-time")
def delivery_time(request: DeliveryRequest) -> dict[str, object]:
    """Minutes until arrival for each order: the fast end, the middle and the slow end."""
    model = engine.delivery
    if model is None:
        raise HTTPException(503, "The arrival-time model is still being trained.")

    columns = {
        name: np.array([getattr(order, name) for order in request.orders], dtype=float)
        for name in ("prep_minutes", "km", "hour", "weekday", "load", "items")
    }
    predicted = model.predict(columns)
    return {
        "model": model.version,
        "predictions": [
            {"p10": round(float(low), 1), "p50": round(float(mid), 1), "p90": round(float(high), 1)}
            for low, mid, high in zip(
                predicted["p10"], predicted["p50"], predicted["p90"], strict=True
            )
        ],
    }


@app.get("/v1/search")
def search(
    q: str = Query(min_length=1, max_length=80),
    limit: int = Query(default=60, ge=1, le=200),
) -> dict[str, object]:
    """Kitchens for what was typed, closest first, each with the dishes that matched."""
    hits = engine.loaded.search.kitchens(q, limit)
    return {
        "query": q,
        "kitchens": [
            {"slug": hit.slug, "score": round(hit.score, 3), "dishes": list(hit.dishes)}
            for hit in hits
        ],
    }


@app.post("/v1/pairings")
def pairings(request: PairingsRequest) -> dict[str, object]:
    """Dishes from the menu that go with what is in the bag."""
    return {"dishes": engine.loaded.pairings.suggest(request.basket, request.menu, request.limit)}


@app.post("/v1/kitchens-for")
def kitchens_for(request: KitchensForRequest) -> dict[str, object]:
    """Kitchens for a customer, from the names of the dishes they have ordered."""
    loaded = engine.loaded
    excluded = set(request.exclude)
    candidates = (
        (kitchen.slug, kitchen.dishes, kitchen.popular)
        for kitchen in loaded.catalogue.kitchens
        if kitchen.slug not in excluded
    )
    history = {line.dish: line.count for line in request.history}
    ranked = loaded.pairings.kitchens_for(history, candidates, request.limit)
    return {
        "kitchens": [
            {"slug": slug, "score": round(score, 4), "because": because}
            for slug, score, because in ranked
        ]
    }
