import uuid
from datetime import date, timedelta

from app.database import SessionLocal
from app.models import Slot

FUTURE = (date.today() + timedelta(days=10)).isoformat()
FUTURE_2 = (date.today() + timedelta(days=20)).isoformat()
PAST = (date.today() - timedelta(days=10)).isoformat()


def _add(client, post_id, headers, dates):
    return client.post(
        f"/api/posts/{post_id}/slots", json={"dates": dates}, headers=headers
    )


# --- POST add ---


def test_add_slots_owner_201(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id)
    response = _add(client, post_id, headers, [FUTURE_2, FUTURE])
    assert response.status_code == 201
    # relationship is ordered by date, so the earlier date comes first
    assert [s["date"] for s in response.json()] == [FUTURE, FUTURE_2]
    assert all(s["available"] for s in response.json())


def test_add_slots_non_owner_403(client, make_user, make_post):
    owner_id, _, _ = make_user()
    post_id = make_post(owner_id)
    _, _, other_headers = make_user()
    response = _add(client, post_id, other_headers, [FUTURE])
    assert response.status_code == 403


def test_add_slots_duplicate_date_409(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id)
    _add(client, post_id, headers, [FUTURE])
    response = _add(client, post_id, headers, [FUTURE])  # same date again
    assert response.status_code == 409


def test_add_slots_duplicate_within_batch_409(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id)
    response = _add(client, post_id, headers, [FUTURE, FUTURE])  # repeated in batch
    assert response.status_code == 409


def test_add_slots_empty_422(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id)
    response = _add(client, post_id, headers, [])
    assert response.status_code == 422


# --- GET list visibility ---


def test_list_slots_public_only_future_available(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id, posted=True)
    slots = _add(client, post_id, headers, [FUTURE, PAST, FUTURE_2]).json()
    unavailable_id = next(s["slot_id"] for s in slots if s["date"] == FUTURE_2)
    client.patch(f"/api/slots/{unavailable_id}/toggle", headers=headers)

    public_dates = [s["date"] for s in client.get(f"/api/posts/{post_id}/slots").json()]
    assert FUTURE in public_dates
    assert PAST not in public_dates  # past hidden
    assert FUTURE_2 not in public_dates  # unavailable hidden


def test_list_slots_owner_sees_all(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id)
    _add(client, post_id, headers, [FUTURE, PAST])
    owner_dates = [
        s["date"]
        for s in client.get(f"/api/posts/{post_id}/slots", headers=headers).json()
    ]
    assert FUTURE in owner_dates
    assert PAST in owner_dates  # owner sees past too


def test_list_slots_nonexistent_post_404(client):
    response = client.get(f"/api/posts/{uuid.uuid4()}/slots")
    assert response.status_code == 404


# --- PATCH toggle ---


def test_toggle_slot_owner(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id)
    slot_id = _add(client, post_id, headers, [FUTURE]).json()[0]["slot_id"]
    response = client.patch(f"/api/slots/{slot_id}/toggle", headers=headers)
    assert response.status_code == 200
    assert response.json()["available"] is False
    # toggling again flips back
    assert client.patch(
        f"/api/slots/{slot_id}/toggle", headers=headers
    ).json()["available"] is True


def test_toggle_slot_non_owner_403(client, make_user, make_post):
    owner_id, _, owner_headers = make_user()
    post_id = make_post(owner_id)
    slot_id = _add(client, post_id, owner_headers, [FUTURE]).json()[0]["slot_id"]
    _, _, other_headers = make_user()
    response = client.patch(f"/api/slots/{slot_id}/toggle", headers=other_headers)
    assert response.status_code == 403


def test_toggle_nonexistent_slot_404(client, make_user):
    _, _, headers = make_user()
    response = client.patch(f"/api/slots/{uuid.uuid4()}/toggle", headers=headers)
    assert response.status_code == 404


# --- DELETE ---


def test_delete_slot_owner(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id)
    slot_id = _add(client, post_id, headers, [FUTURE]).json()[0]["slot_id"]
    response = client.delete(f"/api/slots/{slot_id}", headers=headers)
    assert response.status_code == 204
    assert client.get(f"/api/posts/{post_id}/slots", headers=headers).json() == []


def test_delete_slot_non_owner_403(client, make_user, make_post):
    owner_id, _, owner_headers = make_user()
    post_id = make_post(owner_id)
    slot_id = _add(client, post_id, owner_headers, [FUTURE]).json()[0]["slot_id"]
    _, _, other_headers = make_user()
    response = client.delete(f"/api/slots/{slot_id}", headers=other_headers)
    assert response.status_code == 403


def test_delete_nonexistent_slot_404(client, make_user):
    _, _, headers = make_user()
    response = client.delete(f"/api/slots/{uuid.uuid4()}", headers=headers)
    assert response.status_code == 404


# --- DB cascade ---


def test_delete_post_cascades_slots(client, make_user, make_post):
    user_id, _, headers = make_user()
    post_id = make_post(user_id)
    _add(client, post_id, headers, [FUTURE, FUTURE_2])
    client.delete(f"/api/posts/{post_id}", headers=headers)
    db = SessionLocal()
    try:
        remaining = db.query(Slot).filter(Slot.post_id == post_id).count()
    finally:
        db.close()
    assert remaining == 0
