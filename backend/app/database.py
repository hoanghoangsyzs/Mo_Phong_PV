import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

def load_local_env() -> None:
    """Load backend/.env for local runs without overriding hosting variables."""
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_local_env()
database_url = os.getenv("DATABASE_URL", "sqlite:///./interview.db").strip()
connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}

if database_url.startswith("mysql://"):
    database_url = database_url.replace("mysql://", "mysql+pymysql://", 1)

if database_url.startswith("mysql+"):
    # Aiven's URI includes ssl-mode=REQUIRED, which is a MySQL CLI option rather
    # than a PyMySQL keyword. Remove it and let PyMySQL negotiate TLS with Aiven.
    parsed_url = make_url(database_url)
    query = dict(parsed_url.query)
    ssl_mode = str(query.pop("ssl-mode", "")).upper()
    database_url = parsed_url.set(query=query)
    if ssl_mode in {"REQUIRED", "VERIFY_CA", "VERIFY_IDENTITY", "PREFERRED"}:
        connect_args["ssl_disabled"] = False
    elif ssl_mode == "DISABLED":
        connect_args["ssl_disabled"] = True

engine = create_engine(database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
