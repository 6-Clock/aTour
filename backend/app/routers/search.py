from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas import AISearchRequest, AISearchResponse, AISearchResultItem
from app.services import ai_search as ai_search_service

router = APIRouter(prefix="/api/search", tags=["search"])


@router.post("/ai", response_model=AISearchResponse)
def ai_search(payload: AISearchRequest, db: Session = Depends(get_db)):
    results, ai_available = ai_search_service.ai_search(payload.query, payload.city, db)
    items = [
        AISearchResultItem.model_validate(post).model_copy(
            update={"match_reason": reason}
        )
        for post, reason in results
    ]
    return AISearchResponse(ai_available=ai_available, results=items)
