import uuid

# make_user is provided by conftest.py (shared with the posts tests).


# --- GET /api/users/{user_id} (public) ---


def test_get_public_profile_returns_fields(client, make_user):
    user_id, _, _ = make_user(
        name="Maria", bio="Local foodie", city="Lisbon", languages=["pt", "en"]
    )
    response = client.get(f"/api/users/{user_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Maria"
    assert data["bio"] == "Local foodie"
    assert data["city"] == "Lisbon"
    assert data["languages"] == ["pt", "en"]
    # No reviews exist yet (Ticket 8) -> null, never a misleading 0.0.
    assert data["avg_rating"] is None


def test_public_profile_does_not_leak_email(client, make_user):
    user_id, _, _ = make_user()
    response = client.get(f"/api/users/{user_id}")
    assert response.status_code == 200
    body = response.json()
    assert "email" not in body
    assert "password_hash" not in body


def test_get_public_profile_nonexistent_404(client):
    response = client.get(f"/api/users/{uuid.uuid4()}")
    assert response.status_code == 404


# --- GET /api/users/me (auth) ---


def test_get_me_returns_full_profile_incl_email(client, make_user):
    user_id, email, headers = make_user()
    response = client.get("/api/users/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == email
    assert data["user_id"] == str(user_id)


def test_get_me_not_shadowed_by_user_id_route(client, make_user):
    """Regression: if GET /{user_id} were declared before /me, FastAPI would try
    to parse 'me' as a UUID and return 422. /me must win."""
    _, _, headers = make_user()
    response = client.get("/api/users/me", headers=headers)
    assert response.status_code == 200


def test_get_me_requires_auth_401(client):
    response = client.get("/api/users/me")
    assert response.status_code == 401


# --- PUT /api/users/me (auth) ---


def test_put_me_updates_fields(client, make_user):
    user_id, _, headers = make_user(city="OldCity")
    response = client.put(
        "/api/users/me", json={"name": "New Name", "city": "Porto"}, headers=headers
    )
    assert response.status_code == 200
    assert response.json()["name"] == "New Name"
    assert response.json()["city"] == "Porto"
    # Persisted, visible on the public profile too.
    assert client.get(f"/api/users/{user_id}").json()["city"] == "Porto"


def test_put_me_partial_preserves_other_fields(client, make_user):
    """Regression: a one-field PUT must not wipe fields the client didn't send."""
    _, _, headers = make_user(bio="Original bio", city="Lisbon", languages=["pt"])
    response = client.put("/api/users/me", json={"city": "Porto"}, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["city"] == "Porto"
    assert data["bio"] == "Original bio"
    assert data["languages"] == ["pt"]


def test_put_me_oversized_field_422(client, make_user):
    _, _, headers = make_user()
    response = client.put("/api/users/me", json={"city": "x" * 101}, headers=headers)
    assert response.status_code == 422


def test_put_me_only_edits_own_row(client, make_user):
    """403-by-construction: /me edits only the token's user. There is no path
    param to forge, so user A can never touch user B's row."""
    user_a, _, headers_a = make_user(city="CityA")
    user_b, _, _ = make_user(city="CityB")

    response = client.put(
        "/api/users/me", json={"city": "ChangedByA"}, headers=headers_a
    )
    assert response.status_code == 200

    assert client.get(f"/api/users/{user_a}").json()["city"] == "ChangedByA"
    assert client.get(f"/api/users/{user_b}").json()["city"] == "CityB"


def test_put_me_requires_auth_401(client):
    response = client.put("/api/users/me", json={"city": "X"})
    assert response.status_code == 401
