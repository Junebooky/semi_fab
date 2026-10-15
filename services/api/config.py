import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

def get_db_path() -> str:
    return os.getenv("FAB_SQLITE_PATH", str(DATA_DIR / "fab_one_dev.db"))

SQLITE_DB_PATH = get_db_path()
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]
