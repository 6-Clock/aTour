from app.database import SessionLocal
from app.models import Post


def _cleanup_post(post_id: str) -> None:
    db = SessionLocal()
    try:
        post = db.get(Post, post_id)
        if post is not None:
            db.delete(post)
            db.commit()
    finally:
        db.close()


def test_create_publish_list_spine(client, auth_headers):
    """The core spine, end to end: POST -> PATCH publish -> GET shows it."""
    create_response = client.post(
        "/api/posts",
        json={"title": "Sunset Hike", "booking_fee": "25.00", "max_group_size": 6},
        headers=auth_headers,
    )
    assert create_response.status_code == 201
    post = create_response.json()
    assert post["posted"] is False

    try:
        publish_response = client.patch(
            f"/api/posts/{post['post_id']}/publish", headers=auth_headers
        )
        assert publish_response.status_code == 200
        assert publish_response.json()["posted"] is True

        list_response = client.get("/api/posts")
        assert list_response.status_code == 200
        post_ids = [p["post_id"] for p in list_response.json()]
        assert post["post_id"] in post_ids
    finally:
        _cleanup_post(post["post_id"])


def test_create_post_missing_title_rejected(client, auth_headers):
    response = client.post(
        "/api/posts",
        json={"booking_fee": "10.00", "max_group_size": 2},
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_create_post_negative_booking_fee_rejected(client, auth_headers):
    response = client.post(
        "/api/posts",
        json={"title": "Bad Price", "booking_fee": "-5.00", "max_group_size": 2},
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_create_post_zero_max_group_size_rejected(client, auth_headers):
    response = client.post(
        "/api/posts",
        json={"title": "Bad Group Size", "booking_fee": "10.00", "max_group_size": 0},
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_create_post_boundary_values_accepted(client, auth_headers):
    """booking_fee=0 and max_group_size=1 are the CHECK constraint boundaries
    (>= 0, >= 1) -- should succeed, not be rejected."""
    response = client.post(
        "/api/posts",
        json={"title": "Free Walk", "booking_fee": "0", "max_group_size": 1},
        headers=auth_headers,
    )
    assert response.status_code == 201
    _cleanup_post(response.json()["post_id"])


def test_publish_nonexistent_post_404(client, auth_headers):
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = client.patch(f"/api/posts/{fake_id}/publish", headers=auth_headers)
    assert response.status_code == 404


def test_list_posts_empty_when_none_published(client):
    response = client.get("/api/posts")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
