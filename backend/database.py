import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# The documented local workflow is `cd backend && uvicorn main:app --reload`,
# which starts uvicorn without exporting anything. Load backend/.env here so the
# documented DATABASE_URL is honoured outside docker compose.
load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://metroflow_admin:metroflow_password@localhost:5432/metroflow_db",
)

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
