"""Settings, read from the environment once."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    # Where the Unun API is, and the key its internal addresses ask for. With either
    # one missing, the service runs on the demo data that ships with it.
    api_url: str | None
    internal_key: str | None
    # Rows of invented deliveries to learn from when no saved model is found.
    training_rows: int
    # Minutes between looks at the API for a changed menu or new orders.
    refresh_minutes: int


def load() -> Settings:
    return Settings(
        api_url=os.environ.get("UNUN_API_URL", "http://127.0.0.1:4000").strip() or None,
        internal_key=os.environ.get("INTERNAL_KEY", "unun-dev-key").strip() or None,
        training_rows=int(os.environ.get("TRAINING_ROWS", "60000")),
        refresh_minutes=int(os.environ.get("REFRESH_MINUTES", "10")),
    )
