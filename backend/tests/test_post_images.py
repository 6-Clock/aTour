import uuid

from app.database import SessionLocal
from app.models import PostImage


def _add(client, post_id, headers, urls):
    return client.post(
        f"/api/posts/{post_id}/images", json={"image_urls": urls}, headers=headers
    )


# --- POST add ---


def test_add_images_owner_201(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id)
    response = _add(client, post_id, headers, ["https://img/1.jpg", "https://img/2.jpg"])
    assert response.status_code == 201
    images = response.json()
    assert [i["display_order"] for i in images] == [0, 1]
    assert images[0]["image_url"] == "https://img/1.jpg"


def test_add_images_non_owner_403(client, make_user, make_post):
    owner_id, _, _ = make_user()
    post_id = make_post(owner_id)
    _, _, other_headers = make_user()
    response = _add(client, post_id, other_headers, ["https://img/x.jpg"])
    assert response.status_code == 403


def test_add_images_appends_after_existing(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id)
    _add(client, post_id, headers, ["https://img/1.jpg", "https://img/2.jpg"])
    response = _add(client, post_id, headers, ["https://img/3.jpg"])
    orders = [i["display_order"] for i in response.json()]
    assert orders == [0, 1, 2]  # new image appended at the end


def test_add_images_empty_list_422(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id)
    response = _add(client, post_id, headers, [])
    assert response.status_code == 422


# --- GET list (public) + detail integration ---


def test_list_images_public_ordered(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id)
    _add(client, post_id, headers, ["https://img/a.jpg", "https://img/b.jpg"])
    response = client.get(f"/api/posts/{post_id}/images")
    assert response.status_code == 200
    assert [i["image_url"] for i in response.json()] == [
        "https://img/a.jpg",
        "https://img/b.jpg",
    ]


def test_list_images_nonexistent_post_404(client):
    response = client.get(f"/api/posts/{uuid.uuid4()}/images")
    assert response.status_code == 404


def test_post_detail_includes_images(client, make_user, make_post):
    """Resolves the Ticket 4 images:[] placeholder — GET /api/posts/{id} now
    returns the real ordered images."""
    user_id, _, headers = make_user()
    post_id = make_post(user_id, posted=True)
    _add(client, post_id, headers, ["https://img/1.jpg"])
    detail = client.get(f"/api/posts/{post_id}").json()
    assert len(detail["images"]) == 1
    assert detail["images"][0]["image_url"] == "https://img/1.jpg"


# --- DELETE ---


def test_delete_image_owner(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id)
    image_id = _add(client, post_id, headers, ["https://img/1.jpg"]).json()[0]["image_id"]
    response = client.delete(f"/api/posts/{post_id}/images/{image_id}", headers=headers)
    assert response.status_code == 204
    assert client.get(f"/api/posts/{post_id}/images").json() == []


def test_delete_image_non_owner_403(client, make_user, make_post):
    owner_id, _, owner_headers = make_user()
    post_id = make_post(owner_id)
    image_id = _add(client, post_id, owner_headers, ["https://img/1.jpg"]).json()[0][
        "image_id"
    ]
    _, _, other_headers = make_user()
    response = client.delete(
        f"/api/posts/{post_id}/images/{image_id}", headers=other_headers
    )
    assert response.status_code == 403


def test_delete_image_wrong_post_404(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_a = make_post(user_id)
    post_b = make_post(user_id)
    image_id = _add(client, post_a, headers, ["https://img/1.jpg"]).json()[0]["image_id"]
    # image belongs to post_a, not post_b
    response = client.delete(f"/api/posts/{post_b}/images/{image_id}", headers=headers)
    assert response.status_code == 404


def test_delete_nonexistent_image_404(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id)
    response = client.delete(
        f"/api/posts/{post_id}/images/{uuid.uuid4()}", headers=headers
    )
    assert response.status_code == 404


# --- PATCH reorder ---


def test_reorder_images_owner(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id)
    ids = [
        i["image_id"]
        for i in _add(client, post_id, headers, ["a", "b", "c"]).json()
    ]
    reordered = [ids[2], ids[0], ids[1]]
    response = client.patch(
        f"/api/posts/{post_id}/images/reorder",
        json={"image_ids": reordered},
        headers=headers,
    )
    assert response.status_code == 200
    assert [i["image_id"] for i in response.json()] == reordered


def test_reorder_non_owner_403(client, make_user, make_post):
    owner_id, _, owner_headers = make_user()
    post_id = make_post(owner_id)
    ids = [i["image_id"] for i in _add(client, post_id, owner_headers, ["a", "b"]).json()]
    _, _, other_headers = make_user()
    response = client.patch(
        f"/api/posts/{post_id}/images/reorder",
        json={"image_ids": ids},
        headers=other_headers,
    )
    assert response.status_code == 403


def test_reorder_rejects_foreign_id_400(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id)
    ids = [i["image_id"] for i in _add(client, post_id, headers, ["a", "b"]).json()]
    response = client.patch(
        f"/api/posts/{post_id}/images/reorder",
        json={"image_ids": [ids[0], str(uuid.uuid4())]},
        headers=headers,
    )
    assert response.status_code == 400


def test_reorder_rejects_incomplete_set_400(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id)
    ids = [i["image_id"] for i in _add(client, post_id, headers, ["a", "b", "c"]).json()]
    response = client.patch(
        f"/api/posts/{post_id}/images/reorder",
        json={"image_ids": ids[:2]},  # missing one
        headers=headers,
    )
    assert response.status_code == 400


# --- DB cascade ---


def test_delete_post_cascades_images(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id)
    _add(client, post_id, headers, ["https://img/1.jpg", "https://img/2.jpg"])
    client.delete(f"/api/posts/{post_id}", headers=headers)
    db = SessionLocal()
    try:
        remaining = (
            db.query(PostImage).filter(PostImage.post_id == post_id).count()
        )
    finally:
        db.close()
    assert remaining == 0
