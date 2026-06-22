from pydantic import BaseModel, Field

from app.schemas.post import PostRead


class AISearchRequest(BaseModel):
    """Natural-language search. The query is treated strictly as data — it is
    never spliced into the prompt's instructions (see services/ai_search.py)."""

    query: str = Field(min_length=1, max_length=500)
    city: str | None = None


class AISearchResultItem(PostRead):
    """A matched post plus Gemini's one-line reason. match_reason is None on the
    keyword fallback path (no model ran)."""

    match_reason: str | None = None


class AISearchResponse(BaseModel):
    # False when Gemini was unavailable or errored and results came from the
    # keyword fallback — lets the client tell the user the ranking is degraded.
    ai_available: bool
    results: list[AISearchResultItem]
