import uuid
from datetime import date, timedelta

FUTURE = (date.today() + timedelta(days=10)).isoformat()


def _completed_booking(client, make_user, make_post):
    """Drive a booking all the way to `completed` (the only reviewable state).
    Returns (guide_id, guide_headers, tourist_id, tourist_headers, post_id,
    booking_id)."""
    guide_id, _, guide_headers = make_user()
    post_id = make_post(guide_id, posted=True, max_group_size=4)
    slot_id = client.post(
        f"/api/posts/{post_id}/slots", json={"dates": [FUTURE]}, headers=guide_headers
    ).json()[0]["slot_id"]
    tourist_id, _, tourist_headers = make_user()
    booking_id = client.post(
        "/api/bookings", json={"slot_id": slot_id}, headers=tourist_headers
    ).json()["booking_id"]
    client.post(f"/api/bookings/{booking_id}/confirm", headers=guide_headers)
    client.post(f"/api/bookings/{booking_id}/complete", headers=guide_headers)
    return guide_id, guide_headers, tourist_id, tourist_headers, post_id, booking_id


def _review(client, booking_id, headers, rating=5, comment="Great tour"):
    return client.post(
        "/api/reviews",
        json={"booking_id": booking_id, "rating": rating, "comment": comment},
        headers=headers,
    )


# --- POST /api/reviews ---


def test_create_review_success(client, make_user, make_post):
    *_, tourist_headers, _, booking_id = _completed_booking(client, make_user, make_post)
    response = _review(client, booking_id, tourist_headers, rating=4)
    assert response.status_code == 201
    data = response.json()
    assert data["rating"] == 4
    assert data["booking_id"] == booking_id
    assert data["comment"] == "Great tour"


def test_create_review_comment_optional(client, make_user, make_post):
    *_, tourist_headers, _, booking_id = _completed_booking(client, make_user, make_post)
    response = client.post(
        "/api/reviews",
        json={"booking_id": booking_id, "rating": 5},
        headers=tourist_headers,
    )
    assert response.status_code == 201
    assert response.json()["comment"] is None


def test_create_review_duplicate_409(client, make_user, make_post):
    *_, tourist_headers, _, booking_id = _completed_booking(client, make_user, make_post)
    assert _review(client, booking_id, tourist_headers).status_code == 201
    assert _review(client, booking_id, tourist_headers).status_code == 409


def test_create_review_not_completed_403(client, make_user, make_post):
    """A confirmed-but-not-completed booking isn't eligible."""
    guide_id, _, guide_headers = make_user()
    post_id = make_post(guide_id, posted=True)
    slot_id = client.post(
        f"/api/posts/{post_id}/slots", json={"dates": [FUTURE]}, headers=guide_headers
    ).json()[0]["slot_id"]
    _, _, tourist_headers = make_user()
    booking_id = client.post(
        "/api/bookings", json={"slot_id": slot_id}, headers=tourist_headers
    ).json()["booking_id"]
    client.post(f"/api/bookings/{booking_id}/confirm", headers=guide_headers)
    assert _review(client, booking_id, tourist_headers).status_code == 403


def test_create_review_not_my_booking_403(client, make_user, make_post):
    """A stranger can't review someone else's completed booking."""
    *_, booking_id = _completed_booking(client, make_user, make_post)
    _, _, outsider_headers = make_user()
    assert _review(client, booking_id, outsider_headers).status_code == 403


def test_create_review_guide_cannot_review_403(client, make_user, make_post):
    """The guide on the booking isn't the tourist, so they can't review it."""
    _, guide_headers, _, _, _, booking_id = _completed_booking(
        client, make_user, make_post
    )
    assert _review(client, booking_id, guide_headers).status_code == 403


def test_create_review_nonexistent_booking_403(client, make_user):
    _, _, headers = make_user()
    assert _review(client, str(uuid.uuid4()), headers).status_code == 403


def test_create_review_rating_out_of_range_422(client, make_user, make_post):
    *_, tourist_headers, _, booking_id = _completed_booking(client, make_user, make_post)
    assert _review(client, booking_id, tourist_headers, rating=6).status_code == 422
    assert _review(client, booking_id, tourist_headers, rating=0).status_code == 422


def test_create_review_requires_auth_401(client):
    response = client.post(
        "/api/reviews", json={"booking_id": str(uuid.uuid4()), "rating": 5}
    )
    assert response.status_code == 401


# --- GET /api/posts/{post_id}/reviews ---


def test_list_post_reviews(client, make_user, make_post):
    *_, tourist_headers, post_id, booking_id = _completed_booking(
        client, make_user, make_post
    )
    _review(client, booking_id, tourist_headers, rating=3)
    response = client.get(f"/api/posts/{post_id}/reviews")
    assert response.status_code == 200
    ratings = [r["rating"] for r in response.json()]
    assert 3 in ratings


def test_list_post_reviews_public_no_auth(client, make_user, make_post):
    *_, tourist_headers, post_id, booking_id = _completed_booking(
        client, make_user, make_post
    )
    _review(client, booking_id, tourist_headers)
    # No Authorization header — endpoint is public.
    assert client.get(f"/api/posts/{post_id}/reviews").status_code == 200


def test_list_post_reviews_nonexistent_post_404(client):
    assert client.get(f"/api/posts/{uuid.uuid4()}/reviews").status_code == 404


def test_list_post_reviews_empty_for_post_without_reviews(client, make_user, make_post):
    guide_id, _, _ = make_user()
    post_id = make_post(guide_id, posted=True)
    response = client.get(f"/api/posts/{post_id}/reviews")
    assert response.status_code == 200
    assert response.json() == []


# --- GET /api/users/{user_id}/reviews ---


def test_list_user_reviews(client, make_user, make_post):
    guide_id, _, _, tourist_headers, _, booking_id = _completed_booking(
        client, make_user, make_post
    )
    _review(client, booking_id, tourist_headers, rating=5)
    response = client.get(f"/api/users/{guide_id}/reviews")
    assert response.status_code == 200
    assert 5 in [r["rating"] for r in response.json()]


def test_list_user_reviews_nonexistent_user_404(client):
    assert client.get(f"/api/users/{uuid.uuid4()}/reviews").status_code == 404


# --- avg_rating wired into the public profile ---


def test_avg_rating_none_without_reviews(client, make_user):
    guide_id, _, _ = make_user()
    response = client.get(f"/api/users/{guide_id}")
    assert response.status_code == 200
    assert response.json()["avg_rating"] is None


def test_avg_rating_reflects_reviews(client, make_user, make_post):
    """Two reviews (rating 2 and 4) on a guide => avg_rating 3.0."""
    guide_id, _, guide_headers = make_user()
    post_id = make_post(guide_id, posted=True, max_group_size=4)
    slot_id = client.post(
        f"/api/posts/{post_id}/slots", json={"dates": [FUTURE]}, headers=guide_headers
    ).json()[0]["slot_id"]
    for rating in (2, 4):
        _, _, tourist_headers = make_user()
        booking_id = client.post(
            "/api/bookings", json={"slot_id": slot_id}, headers=tourist_headers
        ).json()["booking_id"]
        client.post(f"/api/bookings/{booking_id}/confirm", headers=guide_headers)
        client.post(f"/api/bookings/{booking_id}/complete", headers=guide_headers)
        _review(client, booking_id, tourist_headers, rating=rating)
    response = client.get(f"/api/users/{guide_id}")
    assert response.json()["avg_rating"] == 3.0
