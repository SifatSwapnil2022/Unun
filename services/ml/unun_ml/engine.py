"""Everything the service has loaded, in one place.

The catalogue and the order history are read at start and again every few minutes. The
search index and the pairing counts are rebuilt from them each time, which takes well
under a second. The arrival-time model is slower to make, so it is trained once, saved,
and loaded from the file after that.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass

from . import catalogue as catalogue_source
from .catalogue import Catalogue
from .config import Settings
from .delivery import MODEL_FILE, DeliveryModel, synthesize
from .pairings import Pairings
from .search import SearchIndex


@dataclass(frozen=True)
class Loaded:
    catalogue: Catalogue
    search: SearchIndex
    pairings: Pairings


def build(catalogue: Catalogue) -> Loaded:
    return Loaded(
        catalogue=catalogue,
        search=SearchIndex(catalogue),
        pairings=Pairings(order.dishes for order in catalogue.orders),
    )


class Engine:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._lock = threading.Lock()
        self.loaded = build(catalogue_source.load_from_files())
        self.delivery: DeliveryModel | None = None

    def refresh(self) -> str:
        """Reads the catalogue again. Returns where it came from: "api" or "file"."""
        fresh = build(catalogue_source.load(self._settings.api_url, self._settings.internal_key))
        with self._lock:
            self.loaded = fresh
        return fresh.catalogue.source

    def ready_delivery(self) -> None:
        """Loads the saved arrival-time model, or trains one if there is none yet.

        Training takes a few seconds, so the service starts answering before it is done.
        Until then the API is told the model is not ready, and uses its own plain rule.
        """
        try:
            model = DeliveryModel.load() if MODEL_FILE.exists() else None
        except Exception:  # A file from another scikit-learn version cannot be read.
            model = None

        if model is None:
            model = DeliveryModel.train(
                synthesize(self._settings.training_rows), trained_on="synthetic"
            )
            model.save()
        self.delivery = model
