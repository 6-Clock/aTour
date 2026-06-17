import datetime as _dt
import sqlalchemy as _sql

import database as _db

class Contact(_db.Base):
    __tablename__ = "UserInfo"
    id = _sql.Column(_sql.Integer, primary_key=True, index=True, unique=True)
    first_name = _sql.Column(_sql.String, primary_key=False, index=True)
    last_name = _sql.Column(_sql.String, primary_key=False, index=True, unique=True)
    email = _sql.Column(_sql.String, unique=True, index=True)