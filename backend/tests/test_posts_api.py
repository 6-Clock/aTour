import uuid
from decimal import Decimal

_CREATE_BODY = {"title": "New Post", "booking_fee": "10.00", "max_group_size": 2}


# --- max-5 enforcement ---


def test_create_6th_post_returns_409(client, make_user, make_post):
    user_id, _, headers = make_user()
    for _ in range(5):
        make_post(user_id)
    response = client.post("/api/posts", json=_CREATE_BODY, headers=headers)
    assert response.status_code == 409


def test_max5_is_per_user(client, make_user, make_post):
    user_a, _, _ = make_user()
    for _ in range(5):
        make_post(user_a)
    _, _, headers_b = make_user()
    # User B is unaffected by user A hitting the cap.
    response = client.post("/api/posts", json=_CREATE_BODY, headers=headers_b)
    assert response.status_code == 201


# --- GET /api/posts list: cover_image_url (for feed/reels cards) ---


def test_list_cover_image_is_first_by_order(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id, posted=True)
    client.post(
        f"/api/posts/{post_id}/images",
        json={"image_urls": ["https://img/a.jpg", "https://img/b.jpg"]},
        headers=headers,
    )
    posts = client.get("/api/posts?limit=100").json()
    row = next(p for p in posts if p["post_id"] == str(post_id))
    assert row["cover_image_url"] == "https://img/a.jpg"


def test_list_cover_image_null_without_images(client, make_user, make_post):
    user_id, _, _ = make_user()
    post_id = make_post(user_id, posted=True)
    posts = client.get("/api/posts?limit=100").json()
    row = next(p for p in posts if p["post_id"] == str(post_id))
    assert row["cover_image_url"] is None


# --- GET /api/posts/{post_id} detail + visibility ---


def test_published_detail_returns_images_empty(client, make_user, make_post):
    user_id, _, _ = make_user()
    post_id = make_post(user_id, posted=True)
    response = client.get(f"/api/posts/{post_id}")
    assert response.status_code == 200
    assert response.json()["images"] == []


def test_unpublished_post_visible_to_owner(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id, posted=False)
    response = client.get(f"/api/posts/{post_id}", headers=headers)
    assert response.status_code == 200


def test_unpublished_post_404_for_non_owner(client, make_user, make_post):
    owner_id, _, _ = make_user()
    post_id = make_post(owner_id, posted=False)
    _, _, other_headers = make_user()
    response = client.get(f"/api/posts/{post_id}", headers=other_headers)
    assert response.status_code == 404


def test_unpublished_post_404_for_anonymous(client, make_user, make_post):
    owner_id, _, _ = make_user()
    post_id = make_post(owner_id, posted=False)
    response = client.get(f"/api/posts/{post_id}")
    assert response.status_code == 404


def test_get_nonexistent_post_404(client):
    response = client.get(f"/api/posts/{uuid.uuid4()}")
    assert response.status_code == 404


# --- PUT /api/posts/{post_id} ---


def test_update_post_owner_partial_preserves_fields(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id, title="Original", max_group_size=4)
    response = client.put(
        f"/api/posts/{post_id}", json={"title": "Updated"}, headers=headers
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Updated"
    assert response.json()["max_group_size"] == 4  # untouched


def test_update_post_non_owner_403(client, make_user, make_post):
    owner_id, _, _ = make_user()
    post_id = make_post(owner_id)
    _, _, other_headers = make_user()
    response = client.put(
        f"/api/posts/{post_id}", json={"title": "Hijack"}, headers=other_headers
    )
    assert response.status_code == 403


def test_update_nonexistent_post_404(client, make_user):
    _, _, headers = make_user()
    response = client.put(
        f"/api/posts/{uuid.uuid4()}", json={"title": "X"}, headers=headers
    )
    assert response.status_code == 404


# --- DELETE /api/posts/{post_id} ---


def test_delete_post_owner_removes_it(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id, posted=True)
    response = client.delete(f"/api/posts/{post_id}", headers=headers)
    assert response.status_code == 204
    assert client.get(f"/api/posts/{post_id}").status_code == 404


def test_delete_post_non_owner_403(client, make_user, make_post):
    owner_id, _, _ = make_user()
    post_id = make_post(owner_id)
    _, _, other_headers = make_user()
    response = client.delete(f"/api/posts/{post_id}", headers=other_headers)
    assert response.status_code == 403


# --- PATCH unpublish + publish-ownership regression ---


def test_unpublish_post_owner(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id, posted=True)
    response = client.patch(f"/api/posts/{post_id}/unpublish", headers=headers)
    assert response.status_code == 200
    assert response.json()["posted"] is False


def test_unpublish_post_non_owner_403(client, make_user, make_post):
    owner_id, _, _ = make_user()
    post_id = make_post(owner_id, posted=True)
    _, _, other_headers = make_user()
    response = client.patch(
        f"/api/posts/{post_id}/unpublish", headers=other_headers
    )
    assert response.status_code == 403


def test_publish_post_non_owner_403(client, make_user, make_post):
    """Regression: publish_post was refactored onto get_owned_post_or_404; its
    ownership-403 path had no test before this."""
    owner_id, _, _ = make_user()
    post_id = make_post(owner_id)
    _, _, other_headers = make_user()
    response = client.patch(f"/api/posts/{post_id}/publish", headers=other_headers)
    assert response.status_code == 403


# --- GET /api/posts browse: filters + pagination ---


def test_browse_filter_by_city_joins_user(client, make_user, make_post):
    city = f"City-{uuid.uuid4().hex[:8]}"
    owner_id, _, _ = make_user(city=city)
    other_id, _, _ = make_user(city="Elsewhere")
    post_id = make_post(owner_id, posted=True)
    make_post(other_id, posted=True)
    response = client.get(f"/api/posts?city={city}")
    assert response.status_code == 200
    ids = [p["post_id"] for p in response.json()]
    assert ids == [str(post_id)]  # unique city -> exactly this post


def test_browse_filter_by_fee_range(client, make_user, make_post):
    city = f"City-{uuid.uuid4().hex[:8]}"
    owner_id, _, _ = make_user(city=city)
    cheap = make_post(owner_id, posted=True, booking_fee=Decimal("5.00"))
    mid = make_post(owner_id, posted=True, booking_fee=Decimal("50.00"))
    pricey = make_post(owner_id, posted=True, booking_fee=Decimal("500.00"))
    response = client.get(f"/api/posts?city={city}&min_fee=10&max_fee=100")
    ids = [p["post_id"] for p in response.json()]
    assert str(mid) in ids
    assert str(cheap) not in ids
    assert str(pricey) not in ids


def test_browse_pagination_limit_offset(client, make_user, make_post):
    city = f"City-{uuid.uuid4().hex[:8]}"
    owner_id, _, _ = make_user(city=city)
    for _ in range(25):
        make_post(owner_id, posted=True)
    page1 = client.get(f"/api/posts?city={city}&limit=20")
    assert len(page1.json()) == 20
    page2 = client.get(f"/api/posts?city={city}&limit=20&offset=20")
    assert len(page2.json()) == 5


def test_browse_excludes_unpublished(client, make_user, make_post):
    city = f"City-{uuid.uuid4().hex[:8]}"
    owner_id, _, _ = make_user(city=city)
    published = make_post(owner_id, posted=True)
    hidden = make_post(owner_id, posted=False)
    ids = [p["post_id"] for p in client.get(f"/api/posts?city={city}").json()]
    assert str(published) in ids
    assert str(hidden) not in ids


# --- GET /api/users/{user_id}/posts ---


def test_user_posts_public_shows_published_only(client, make_user, make_post):
    user_id, _, _ = make_user()
    published = make_post(user_id, posted=True)
    hidden = make_post(user_id, posted=False)
    response = client.get(f"/api/users/{user_id}/posts")
    assert response.status_code == 200
    ids = [p["post_id"] for p in response.json()]
    assert str(published) in ids
    assert str(hidden) not in ids


def test_user_posts_owner_shows_all(client, make_user, make_post):
    user_id, _, headers = make_user()
    published = make_post(user_id, posted=True)
    hidden = make_post(user_id, posted=False)
    response = client.get(f"/api/users/{user_id}/posts", headers=headers)
    ids = [p["post_id"] for p in response.json()]
    assert str(published) in ids
    assert str(hidden) in ids


def test_user_posts_unknown_user_404(client):
    response = client.get(f"/api/users/{uuid.uuid4()}/posts")
    assert response.status_code == 404


# --- guide_name on list and detail ---


def test_list_posts_includes_guide_name(client, make_user, make_post):
    user_id, _, _ = make_user(name="Maria Guide")
    make_post(user_id, posted=True)
    posts = client.get("/api/posts?limit=100").json()
    row = next(p for p in posts if p["user_id"] == str(user_id))
    assert row["guide_name"] == "Maria Guide"


def test_post_detail_includes_guide_name(client, make_user, make_post):
    user_id, _, _ = make_user(name="Maria Guide")
    post_id = make_post(user_id, posted=True)
    data = client.get(f"/api/posts/{post_id}").json()
    assert data["guide_name"] == "Maria Guide"
