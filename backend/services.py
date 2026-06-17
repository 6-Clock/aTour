from typing import TYPE_CHECKING,List

import database as _db
import models as _models
import schemas as _schemas


if TYPE_CHECKING:
    from sqlalchemy.orm import Session

def _add_tables_db():
    return _db.Base.metadata.create_all(bind=_db.engine)



def get_db():
    db = _db.SessionLocal()
    try:
        yield db
    finally:
        db.close()


#create contact
async def create_contact(contact: _schemas.CreateContact, db: "Session") -> _schemas.Contact:
    contact = _models.Contact(**contact.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    # Pydantic v2: Contact.from_orm(contact) is deprecated, use model_validate instead
    # (requires model_config = ConfigDict(from_attributes=True) on the Contact schema, see schemas.py)
    return _schemas.Contact.model_validate(contact)


async def get_all_contacts(db:"Session") -> List[_schemas.Contact]:
    contacts = db.query(_models.Contact).all()
    return list(map(_schemas.Contact.model_validate, contacts))
    
async def get_contact_by_id(contact_id: int, db:"Session") -> _schemas.Contact:
    contact = db.query(_models.Contact).filter(_models.Contact.id == contact_id).first()
    return contact


async def delete_contact(contact: _models.Contact, db:"Session"):
    db.delete(contact)
    db.commit()

async def update_contact(contact_data: _schemas.Contact, contact:_models.Contact, db: "Session") -> _schemas.Contact:
    contact.first_name = contact_data.first_name
    contact.last_name = contact_data.last_name
    contact.email = contact_data.email

    db.commit()
    db.refresh(contact)

    return _schemas.Contact.model_validate(contact)