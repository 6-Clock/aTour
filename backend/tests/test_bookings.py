import uuid
from datetime import date, timedelta

FUTURE = (date.today() + timedelta(days=10)).isoformat()


def _guide_with_slot(client, make_user, make_post, max_group_size=4):
    """A published post owned by a fresh guide, with one future open slot.
    Returns (guide_id, guide_headers, slot_id)."""
    guide_id, _, guide_headers = make_user()
    post_id = make_post(guide_id, posted=True, max_group_size=max_group_size)
    slot_id = client.post(
        f"/api/posts/{post_id}/slots", json={"dates": [FUTURE]}, headers=guide_headers
    ).json()[0]["slot_id"]
    return guide_id, guide_headers, slot_id


def _book(client, slot_id, headers):
    return client.post("/api/bookings", json={"slot_id": slot_id}, headers=headers)


# --- POST create ---


def test_create_booking_success(client, make_user, make_post):
    guide_id, _, slot_id = _guide_with_slot(client, make_user, make_post)
    tourist_id, _, tourist_headers = make_user()
    response = _book(client, slot_id, tourist_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "pending"
    assert data["guide_id"] == str(guide_id)  # denormalized from slot->post
    assert data["tourist_id"] == str(tourist_id)


def test_create_booking_own_post_409(client, make_user, make_post):
    _, guide_headers, slot_id = _guide_with_slot(client, make_user, make_post)
    response = _book(client, slot_id, guide_headers)  # guide books own slot
    assert response.status_code == 409


def test_create_booking_full_slot_409(client, make_user, make_post):
    _, _, slot_id = _guide_with_slot(client, make_user, make_post, max_group_size=1)
    _, _, t1 = make_user()
    _, _, t2 = make_user()
    assert _book(client, slot_id, t1).status_code == 201
    assert _book(client, slot_id, t2).status_code == 409  # full


def test_create_booking_unavailable_slot_409(client, make_user, make_post):
    _, guide_headers, slot_id = _guide_with_slot(client, make_user, make_post)
    client.patch(f"/api/slots/{slot_id}/toggle", headers=guide_headers)  # close it
    _, _, tourist_headers = make_user()
    assert _book(client, slot_id, tourist_headers).status_code == 409


def test_create_booking_nonexistent_slot_404(client, make_user):
    _, _, headers = make_user()
    response = client.post(
        "/api/bookings", json={"slot_id": str(uuid.uuid4())}, headers=headers
    )
    assert response.status_code == 404


def test_create_booking_requires_auth_401(client):
    response = client.post("/api/bookings", json={"slot_id": str(uuid.uuid4())})
    assert response.status_code == 401


# --- one booking per date: booking closes the slot ---


def test_booking_closes_the_slot(client, make_user, make_post):
    """After a booking, the same tourist cannot book the same date again."""
    _, _, slot_id = _guide_with_slot(client, make_user, make_post)
    _, _, tourist_headers = make_user()
    assert _book(client, slot_id, tourist_headers).status_code == 201
    assert _book(client, slot_id, tourist_headers).status_code == 409


def test_second_tourist_cannot_book_taken_date(client, make_user, make_post):
    _, _, slot_id = _guide_with_slot(client, make_user, make_post, max_group_size=4)
    _, _, t1 = make_user()
    _, _, t2 = make_user()
    assert _book(client, slot_id, t1).status_code == 201
    # Even with group capacity 4, the date is closed after the first booking.
    assert _book(client, slot_id, t2).status_code == 409


def test_cancel_reopens_the_date(client, make_user, make_post):
    _, _, slot_id = _guide_with_slot(client, make_user, make_post)
    _, _, t1 = make_user()
    _, _, t2 = make_user()
    booking_id = _book(client, slot_id, t1).json()["booking_id"]
    assert _book(client, slot_id, t2).status_code == 409  # date taken
    client.post(f"/api/bookings/{booking_id}/cancel", headers=t1)
    assert _book(client, slot_id, t2).status_code == 201  # reopened


# --- GET detail access control ---


def test_get_booking_as_tourist(client, make_user, make_post):
    _, _, slot_id = _guide_with_slot(client, make_user, make_post)
    _, _, tourist_headers = make_user()
    booking_id = _book(client, slot_id, tourist_headers).json()["booking_id"]
    assert (
        client.get(f"/api/bookings/{booking_id}", headers=tourist_headers).status_code
        == 200
    )


def test_get_booking_as_guide(client, make_user, make_post):
    _, guide_headers, slot_id = _guide_with_slot(client, make_user, make_post)
    _, _, tourist_headers = make_user()
    booking_id = _book(client, slot_id, tourist_headers).json()["booking_id"]
    assert (
        client.get(f"/api/bookings/{booking_id}", headers=guide_headers).status_code
        == 200
    )


def test_get_booking_outsider_403(client, make_user, make_post):
    _, _, slot_id = _guide_with_slot(client, make_user, make_post)
    _, _, tourist_headers = make_user()
    booking_id = _book(client, slot_id, tourist_headers).json()["booking_id"]
    _, _, outsider_headers = make_user()
    assert (
        client.get(f"/api/bookings/{booking_id}", headers=outsider_headers).status_code
        == 403
    )


def test_get_nonexistent_booking_404(client, make_user):
    _, _, headers = make_user()
    assert client.get(f"/api/bookings/{uuid.uuid4()}", headers=headers).status_code == 404


# --- GET /my ---


def test_list_my_as_tourist(client, make_user, make_post):
    _, _, slot_id = _guide_with_slot(client, make_user, make_post)
    _, _, tourist_headers = make_user()
    booking_id = _book(client, slot_id, tourist_headers).json()["booking_id"]
    response = client.get("/api/bookings/my?as=tourist", headers=tourist_headers)
    assert response.status_code == 200
    assert booking_id in [b["booking_id"] for b in response.json()]


def test_list_my_as_guide(client, make_user, make_post):
    _, guide_headers, slot_id = _guide_with_slot(client, make_user, make_post)
    _, _, tourist_headers = make_user()
    booking_id = _book(client, slot_id, tourist_headers).json()["booking_id"]
    response = client.get("/api/bookings/my?as=guide", headers=guide_headers)
    assert booking_id in [b["booking_id"] for b in response.json()]


def test_list_my_requires_as_param_422(client, make_user):
    _, _, headers = make_user()
    assert client.get("/api/bookings/my", headers=headers).status_code == 422


def test_list_my_not_shadowed_by_id_route(client, make_user):
    """Regression: /my must be matched before /{booking_id} (else 'my' fails
    UUID parse and 422s)."""
    _, _, headers = make_user()
    assert client.get("/api/bookings/my?as=tourist", headers=headers).status_code == 200


# --- confirm / cancel transitions ---


def test_confirm_booking_by_guide(client, make_user, make_post):
    _, guide_headers, slot_id = _guide_with_slot(client, make_user, make_post)
    _, _, tourist_headers = make_user()
    booking_id = _book(client, slot_id, tourist_headers).json()["booking_id"]
    response = client.post(
        f"/api/bookings/{booking_id}/confirm", headers=guide_headers
    )
    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"


def test_confirm_booking_by_tourist_403(client, make_user, make_post):
    _, _, slot_id = _guide_with_slot(client, make_user, make_post)
    _, _, tourist_headers = make_user()
    booking_id = _book(client, slot_id, tourist_headers).json()["booking_id"]
    assert (
        client.post(
            f"/api/bookings/{booking_id}/confirm", headers=tourist_headers
        ).status_code
        == 403
    )


def test_confirm_already_confirmed_422(client, make_user, make_post):
    _, guide_headers, slot_id = _guide_with_slot(client, make_user, make_post)
    _, _, tourist_headers = make_user()
    booking_id = _book(client, slot_id, tourist_headers).json()["booking_id"]
    client.post(f"/api/bookings/{booking_id}/confirm", headers=guide_headers)
    second = client.post(f"/api/bookings/{booking_id}/confirm", headers=guide_headers)
    assert second.status_code == 422  # not pending anymore


def test_cancel_booking_by_tourist(client, make_user, make_post):
    _, _, slot_id = _guide_with_slot(client, make_user, make_post)
    _, _, tourist_headers = make_user()
    booking_id = _book(client, slot_id, tourist_headers).json()["booking_id"]
    response = client.post(
        f"/api/bookings/{booking_id}/cancel", headers=tourist_headers
    )
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


def test_cancel_already_cancelled_422(client, make_user, make_post):
    _, _, slot_id = _guide_with_slot(client, make_user, make_post)
    _, _, tourist_headers = make_user()
    booking_id = _book(client, slot_id, tourist_headers).json()["booking_id"]
    client.post(f"/api/bookings/{booking_id}/cancel", headers=tourist_headers)
    second = client.post(f"/api/bookings/{booking_id}/cancel", headers=tourist_headers)
    assert second.status_code == 422


def test_cancel_restores_capacity(client, make_user, make_post):
    _, _, slot_id = _guide_with_slot(client, make_user, make_post, max_group_size=1)
    _, _, t1 = make_user()
    _, _, t2 = make_user()
    booking_id = _book(client, slot_id, t1).json()["booking_id"]
    assert _book(client, slot_id, t2).status_code == 409  # full
    client.post(f"/api/bookings/{booking_id}/cancel", headers=t1)
    assert _book(client, slot_id, t2).status_code == 201  # seat freed


# --- complete transition (Ticket 8 unblock: confirmed -> completed) ---


def _confirmed_booking(client, make_user, make_post):
    """Set up a confirmed booking. Returns (guide_headers, tourist_headers,
    booking_id)."""
    _, guide_headers, slot_id = _guide_with_slot(client, make_user, make_post)
    _, _, tourist_headers = make_user()
    booking_id = _book(client, slot_id, tourist_headers).json()["booking_id"]
    client.post(f"/api/bookings/{booking_id}/confirm", headers=guide_headers)
    return guide_headers, tourist_headers, booking_id


def test_complete_booking_by_guide(client, make_user, make_post):
    guide_headers, _, booking_id = _confirmed_booking(client, make_user, make_post)
    response = client.post(
        f"/api/bookings/{booking_id}/complete", headers=guide_headers
    )
    assert response.status_code == 200
    assert response.json()["status"] == "completed"


def test_complete_booking_by_tourist_403(client, make_user, make_post):
    _, tourist_headers, booking_id = _confirmed_booking(client, make_user, make_post)
    assert (
        client.post(
            f"/api/bookings/{booking_id}/complete", headers=tourist_headers
        ).status_code
        == 403
    )


def test_complete_pending_booking_422(client, make_user, make_post):
    """A pending (not yet confirmed) booking can't jump straight to completed."""
    _, guide_headers, slot_id = _guide_with_slot(client, make_user, make_post)
    _, _, tourist_headers = make_user()
    booking_id = _book(client, slot_id, tourist_headers).json()["booking_id"]
    assert (
        client.post(
            f"/api/bookings/{booking_id}/complete", headers=guide_headers
        ).status_code
        == 422
    )


def test_completed_booking_cannot_be_cancelled_422(client, make_user, make_post):
    """completed is terminal — cancel only acts on active statuses."""
    guide_headers, tourist_headers, booking_id = _confirmed_booking(
        client, make_user, make_post
    )
    client.post(f"/api/bookings/{booking_id}/complete", headers=guide_headers)
    assert (
        client.post(
            f"/api/bookings/{booking_id}/cancel", headers=tourist_headers
        ).status_code
        == 422
    )


# --- slot-delete guard (Ticket 6 criterion, now wired) ---


def test_delete_slot_blocked_by_active_booking_409(client, make_user, make_post):
    _, guide_headers, slot_id = _guide_with_slot(client, make_user, make_post)
    _, _, tourist_headers = make_user()
    _book(client, slot_id, tourist_headers)
    assert client.delete(f"/api/slots/{slot_id}", headers=guide_headers).status_code == 409


def test_delete_slot_allowed_when_booking_cancelled(client, make_user, make_post):
    _, guide_headers, slot_id = _guide_with_slot(client, make_user, make_post)
    _, _, tourist_headers = make_user()
    booking_id = _book(client, slot_id, tourist_headers).json()["booking_id"]
    client.post(f"/api/bookings/{booking_id}/cancel", headers=tourist_headers)
    assert client.delete(f"/api/slots/{slot_id}", headers=guide_headers).status_code == 204
