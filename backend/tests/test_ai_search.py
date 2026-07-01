"""Ticket 9 — AI search. The Gemini call (ai_search.rank_with_gemini) is mocked
so tests never hit the network; the DB query, ranking assembly, and keyword
fallback are exercised for real."""

import app.services.ai_search as ai_search


def _published(make_user, make_post):
    """A guide in Lisbon with two published posts. Returns (food_id, kayak_id)."""
    guide_id, _, _ = make_user(city="Lisbon")
    food_id = make_post(guide_id, posted=True, title="Lisbon Food Walk")
    kayak_id = make_post(guide_id, posted=True, title="Sunset Kayak Tour")
    return str(food_id), str(kayak_id)


def test_ai_path_returns_ranked_with_reasons(
    client, make_user, make_post, monkeypatch
):
    food_id, _ = _published(make_user, make_post)
    monkeypatch.setattr(ai_search, "AI_SEARCH_ENABLED", True)
    monkeypatch.setattr(ai_search, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(
        ai_search,
        "rank_with_gemini",
        lambda query, listings: {food_id: "Matches your craving for street food."},
    )

    response = client.post("/api/search/ai", json={"query": "where can I eat?"})
    assert response.status_code == 200
    body = response.json()
    assert body["ai_available"] is True
    assert len(body["results"]) == 1
    assert body["results"][0]["post_id"] == food_id
    assert body["results"][0]["match_reason"] == "Matches your craving for street food."


def test_ai_path_ignores_unknown_post_ids(client, make_user, make_post, monkeypatch):
    """A hallucinated post_id from the model is dropped, not returned."""
    food_id, _ = _published(make_user, make_post)
    monkeypatch.setattr(ai_search, "AI_SEARCH_ENABLED", True)
    monkeypatch.setattr(ai_search, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(
        ai_search,
        "rank_with_gemini",
        lambda query, listings: {
            "00000000-0000-0000-0000-000000000000": "made up",
            food_id: "real one",
        },
    )

    body = client.post("/api/search/ai", json={"query": "food"}).json()
    ids = [r["post_id"] for r in body["results"]]
    assert ids == [food_id]


def test_falls_back_to_keyword_when_gemini_errors(
    client, make_user, make_post, monkeypatch
):
    food_id, kayak_id = _published(make_user, make_post)
    monkeypatch.setattr(ai_search, "AI_SEARCH_ENABLED", True)
    monkeypatch.setattr(ai_search, "GEMINI_API_KEY", "test-key")

    def boom(query, listings):
        raise RuntimeError("gemini down")

    monkeypatch.setattr(ai_search, "rank_with_gemini", boom)

    body = client.post("/api/search/ai", json={"query": "kayak"}).json()
    assert body["ai_available"] is False
    ids = [r["post_id"] for r in body["results"]]
    assert kayak_id in ids
    # Keyword fallback never invents a reason.
    assert all(r["match_reason"] is None for r in body["results"])


def test_falls_back_when_no_api_key(client, make_user, make_post, monkeypatch):
    food_id, _ = _published(make_user, make_post)
    monkeypatch.setattr(ai_search, "GEMINI_API_KEY", None)

    body = client.post("/api/search/ai", json={"query": "food walk"}).json()
    assert body["ai_available"] is False
    assert food_id in [r["post_id"] for r in body["results"]]


def test_city_filter_excludes_other_cities(client, make_user, make_post, monkeypatch):
    _published(make_user, make_post)  # Lisbon guide
    monkeypatch.setattr(ai_search, "GEMINI_API_KEY", None)

    body = client.post(
        "/api/search/ai", json={"query": "anything", "city": "Paris"}
    ).json()
    assert body["results"] == []


def test_disabled_switch_skips_gemini(client, make_user, make_post, monkeypatch):
    """AI_SEARCH_ENABLED=false → never call Gemini even with a key present."""
    food_id, _ = _published(make_user, make_post)
    monkeypatch.setattr(ai_search, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(ai_search, "AI_SEARCH_ENABLED", False)

    def must_not_run(query, listings):
        raise AssertionError("rank_with_gemini called while AI search disabled")

    monkeypatch.setattr(ai_search, "rank_with_gemini", must_not_run)

    body = client.post("/api/search/ai", json={"query": "food walk"}).json()
    assert body["ai_available"] is False
    assert food_id in [r["post_id"] for r in body["results"]]


def test_empty_query_is_422(client):
    assert client.post("/api/search/ai", json={"query": ""}).status_code == 422


def test_search_requires_no_auth(client, make_user, make_post, monkeypatch):
    """The endpoint is public — no Authorization header needed."""
    _published(make_user, make_post)
    monkeypatch.setattr(ai_search, "GEMINI_API_KEY", None)
    assert client.post("/api/search/ai", json={"query": "tour"}).status_code == 200


def test_search_results_include_guide_name(client, make_user, make_post, monkeypatch):
    _published(make_user, make_post)
    monkeypatch.setattr(ai_search, "GEMINI_API_KEY", None)
    body = client.post("/api/search/ai", json={"query": "food walk"}).json()
    assert len(body["results"]) > 0
    assert body["results"][0]["guide_name"] is not None
