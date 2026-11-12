import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# The documented local workflow is `cd backend && uvicorn main:app --reload`,
# which starts uvicorn without exporting anything. Load backend/.env here so the
# documented DATABASE_URL is honoured outside docker compose.
load_dotenv()

from config import settings  # noqa: E402 (after load_dotenv, see above)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://metroflow_admin:metroflow_password@localhost:5432/metroflow_db",
)

# ``pool_pre_ping`` matters when the database sits behind a connection pooler, as
# the hosted Supabase deployment does: an idle pooled connection can be closed
# under us, and without the check the first query after the drop fails. The
# pool size itself lives in Settings (see its db_pool_size/db_max_overflow
# comment) -- defaults are kept small for serverless, override via the
# environment for a long-running local dev server.
engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
