from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.routers.auth import router as auth_router
from app.routers.posts import router as posts_router
from app.routers.users import router as users_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(posts_router)
app.include_router(users_router)


@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(select(1))
    except OperationalError:
        raise HTTPException(status_code=503, detail="database unreachable")
    return {"status": "ok"}
