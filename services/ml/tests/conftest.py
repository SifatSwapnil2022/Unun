import pytest

from unun_ml.catalogue import Catalogue, load_from_files


@pytest.fixture(scope="session")
def catalogue() -> Catalogue:
    """The demo catalogue and order history that ship with the service."""
    return load_from_files()
