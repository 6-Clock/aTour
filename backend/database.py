import os as _os

import dotenv as _dotenv
import sqlalchemy as _sql
import sqlalchemy.ext.declarative as _declarative
import sqlalchemy.orm as _orm

_dotenv.load_dotenv()

DATABASE_URL = _os.environ["DATABASE_URL"]

engine = _sql.create_engine(DATABASE_URL)

SessionLocal = _orm.sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = _declarative.declarative_base()
