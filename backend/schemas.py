import pydantic as _pydantic


class _BaseContact(_pydantic.BaseModel):
    first_name: str
    last_name: str
    email: str

class Contact(_BaseContact):
    id: int
    # Pydantic v2: orm_mode is renamed/replaced. Add this so model_validate()
    # accepts a SQLAlchemy object (attribute access) instead of only a dict:
    model_config = _pydantic.ConfigDict(from_attributes=True)

class CreateContact(_BaseContact):
    pass