# aTour — Backend API Tickets

> Stack: **FastAPI + SQLAlchemy 2.0 + PostgreSQL + JWT (python-jose) + Google Gemini + Alembic + Docker Compose**
>
> **Stack notes:**
> - `python-jose[cryptography]` + `passlib[bcrypt]` for JWT auth and password hashing.
> - `Alembic` for migrations — non-negotiable for a schema that will evolve.
> - `google-generativeai` (official Python SDK) for Gemini calls.
> - **Single `User` table** — no separate Guide/Tourist models. Any user can create posts (guide behavior) or make bookings (tourist behavior). Role is inferred from action, not stored.
> - All primary keys are **UUID** (`gen_random_uuid()`), not integers.
> - OAuth (Google social login) is out of scope for v1.

---

## Ticket 1 — Project Foundation & Database Setup

**Summary**
Rebuild the backend from the contacts-CRUD skeleton into the aTour domain. Configure Docker Compose, Alembic, and SQLAlchemy, and define all six core models matching the schema in `data_table.md`. This is the prerequisite for every other ticket.

**Acceptance Criteria**
- `docker-compose up` starts FastAPI and PostgreSQL with no manual steps
- `GET /health` returns `{ "status": "ok" }` and confirms DB connectivity
- All six SQLAlchemy models are defined: `User`, `Post`, `PostImage`, `Slot`, `Booking`, `Review`
- Alembic is configured; `alembic upgrade head` applies all migrations cleanly from scratch
- `DATABASE_URL` and all secrets come from `.env` — no hardcoded values
- Existing contacts-CRUD code (`examplefastapi.py`, old `models.py`, `schemas.py`, `services.py`) is removed

**Design / Technical Approach**

```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, router registration
│   ├── database.py          # engine, SessionLocal, Base
│   ├── models/
│   │   ├── user.py          # User table
│   │   ├── post.py          # Post + PostImage tables
│   │   ├── slot.py          # Slot table
│   │   ├── booking.py       # Booking table
│   │   └── review.py        # Review table
│   ├── schemas/             # Pydantic v2 request/response models
│   ├── routers/             # one file per domain
│   ├── services/            # business logic, keeps routers thin
│   └── dependencies.py      # get_db, get_current_user
├── alembic/
├── alembic.ini
├── requirements.txt
└── Dockerfile
```

Model relationships (mirrors `data_table.md`):
```
User (1) ──────────< Post (many)
Post (1) ──────────< PostImage (many)
Post (1) ──────────< Slot (many)
Slot (1) ──────────< Booking (many)
User (1) ──────────< Booking (many, as guide_id)
User (1) ──────────< Booking (many, as tourist_id)
Booking (1) ───────── Review (1)
```

All PKs use `UUID` with `server_default=text("gen_random_uuid()")`.

---

## Ticket 2 — Authentication (JWT)

**Summary**
Single registration and login flow for all users. No roles stored — a user becomes a "guide" by creating a post and a "tourist" by making a booking. JWT payload carries only `user_id` and `exp`. Protected routes use a `get_current_user` dependency to resolve the token.

**Acceptance Criteria**
- `POST /api/auth/register` creates a User, returns a JWT
- `POST /api/auth/login` accepts email + password, returns a JWT
- Passwords are hashed with bcrypt — plaintext is never stored or logged
- JWT payload: `{ "sub": "<user_id>", "exp": <timestamp> }`
- `401 Unauthorized` for invalid credentials or expired token
- `get_current_user` FastAPI dependency decodes the token and injects the `User` object on protected routes
- Duplicate email registration returns `409 Conflict`

**Design / Technical Approach**

Libraries: `python-jose[cryptography]`, `passlib[bcrypt]`.

```python
# dependencies.py
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = jose.jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    user = db.get(User, payload["sub"])
    if not user:
        raise HTTPException(401)
    return user
```

`SECRET_KEY` and `ACCESS_TOKEN_EXPIRE_MINUTES` come from `.env`. No refresh tokens in v1.

---

## Ticket 3 — User Profile API

**Summary**
Users manage their own profile — name, bio, languages, city, profile photo. There is no separate guide or tourist profile; the same `User` row serves both contexts. A user's public profile shows their posts and aggregate rating from reviews received on their slots.

**Acceptance Criteria**
- `GET /api/users/{user_id}` returns public profile: name, bio, city, languages, profile_photo, avg_rating (computed), created_at (no auth required)
- `GET /api/users/me` returns the authenticated user's full profile including email
- `PUT /api/users/me` allows the authenticated user to update name, bio, languages, city, profile_photo URL
- A user cannot modify another user's profile — `403` if they try via a crafted request
- `avg_rating` is computed: `AVG(rating)` from all `Review` rows linked to `Booking` rows where `guide_id = user_id`

**Design / Technical Approach**

`profile_photo` stores a Supabase Storage URL string — file upload handled client-side via signed URLs (out of scope for the API in v1).

`avg_rating` is computed at query time in the service layer, not stored, so it is always accurate.

---

## Ticket 4 — Post (Listing) API

**Summary**
Posts are the guide's listings — a street food walk, a sunset hike, etc. A user can have at most 5 posts. Posts start hidden (`posted = false`) and are published explicitly. This ticket covers full CRUD plus browse for tourists.

**Acceptance Criteria**
- `POST /api/posts` creates a post for the authenticated user; returns `409` if they already have 5 posts
- `GET /api/posts/{post_id}` returns full post detail including images (public)
- `PUT /api/posts/{post_id}` updates post fields (owner only)
- `DELETE /api/posts/{post_id}` deletes the post; cascades to `PostImage` and `Slot` (owner only)
- `PATCH /api/posts/{post_id}/publish` toggles `posted` to `true`
- `PATCH /api/posts/{post_id}/unpublish` toggles `posted` to `false`
- `GET /api/posts` returns a paginated list of **published** posts (public); supports `?city=`, `?min_fee=`, `?max_fee=`
- `GET /api/users/{user_id}/posts` returns all posts for a given user (public shows only published; owner sees all)
- Max 5 posts per user is enforced with a count check before INSERT, not a DB constraint

**Design / Technical Approach**

Post fields match `data_table.md`: `post_id (UUID)`, `user_id (FK)`, `title`, `description`, `booking_fee (NUMERIC 10,2)`, `max_group_size (INT, ≥1)`, `posted (BOOLEAN, default false)`, `created_at`.

Browse query filters `where posted = true`. Owner viewing their own posts sees all regardless of `posted`.

Max-5 check:
```python
count = db.scalar(select(func.count()).where(Post.user_id == current_user.user_id))
if count >= 5:
    raise HTTPException(409, "Maximum of 5 posts per user")
```

---

## Ticket 5 — PostImage API

**Summary**
Each post can have multiple ordered images stored as Supabase Storage URLs. Images are a child table of Post and can be added, reordered, or removed independently.

**Acceptance Criteria**
- `POST /api/posts/{post_id}/images` adds one or more image URLs to a post (owner only)
- `GET /api/posts/{post_id}/images` returns all images for a post ordered by `display_order` (public)
- `DELETE /api/posts/{post_id}/images/{image_id}` removes a single image (owner only)
- `PATCH /api/posts/{post_id}/images/reorder` accepts an ordered list of `image_id`s and updates `display_order` values (owner only)
- A non-owner attempting any write returns `403`

**Design / Technical Approach**

PostImage fields: `image_id (UUID)`, `post_id (FK → Post, ON DELETE CASCADE)`, `image_url (TEXT)`, `display_order (INT, default 0)`.

Reorder endpoint receives `["uuid1", "uuid2", "uuid3"]` and sets `display_order = index` for each in a single transaction.

File upload is handled client-side (Supabase Storage signed URLs) — the API only stores the resulting URL string.

---

## Ticket 6 — Slot API

**Summary**
Slots are the available dates a guide opens for a specific post. Each post can have at most one slot per calendar day (`UNIQUE(post_id, date)`). Guides can toggle slots open/closed and the app checks remaining capacity before allowing a booking.

**Acceptance Criteria**
- `POST /api/posts/{post_id}/slots` adds one or more date slots (owner only); bulk creation accepted
- `GET /api/posts/{post_id}/slots` returns all slots for a post — public sees only future slots where `available = true`; owner sees all
- `PATCH /api/slots/{slot_id}/toggle` flips `available` between `true` and `false` (owner only)
- `DELETE /api/slots/{slot_id}` removes a slot (owner only); blocked if any non-cancelled booking exists for it — returns `409`
- Inserting a duplicate `(post_id, date)` pair returns `409 Conflict`

**Design / Technical Approach**

Slot fields: `slot_id (UUID)`, `post_id (FK → Post, ON DELETE CASCADE)`, `date (DATE)`, `available (BOOLEAN, default true)`.

Capacity check (used in the Booking ticket, not stored on Slot):
```python
booking_count = db.scalar(
    select(func.count()).where(
        Booking.slot_id == slot_id,
        Booking.status.in_(["pending", "confirmed"])
    )
)
if booking_count >= post.max_group_size:
    raise HTTPException(409, "This slot is full")
```

`UNIQUE(post_id, date)` is enforced at the DB level via the Alembic migration.

---

## Ticket 7 — Booking API

**Summary**
Bookings link a tourist to a specific slot. `guide_id` is denormalized on the row for fast guide-side dashboard queries. A user cannot book their own slot. Capacity is checked before booking is accepted.

**Acceptance Criteria**
- `POST /api/bookings` creates a booking (auth required); returns `409` if slot is full or `guide_id == tourist_id`
- `GET /api/bookings/{booking_id}` returns booking detail (accessible only by the tourist or guide on that booking)
- `GET /api/bookings/my` returns all bookings for the authenticated user, scoped by role query param `?as=tourist` or `?as=guide`
- `POST /api/bookings/{booking_id}/confirm` transitions `pending → confirmed` (guide only)
- `POST /api/bookings/{booking_id}/cancel` transitions to `cancelled` (tourist or guide); restores capacity
- Attempting an invalid status transition returns `422`
- `guide_id` on the booking row is populated from `Slot → Post → user_id` at insert time

**Design / Technical Approach**

Booking fields: `booking_id (UUID)`, `slot_id (FK → Slot)`, `guide_id (FK → User)`, `tourist_id (FK → User)`, `status (ENUM: pending/confirmed/cancelled/completed)`, `created_at`.

Self-booking guard:
```python
if slot.post.user_id == current_user.user_id:
    raise HTTPException(403, "You cannot book your own post")
```

`guide_id` is written at insert from `slot.post.user_id` — denormalized deliberately so guide dashboard queries skip two joins.

v1 uses manual confirm flow (guide confirms). `completed` status is set manually or via a future background job after the slot date passes.

---

## Ticket 8 — Review API

**Summary**
After a tour, tourists leave a star rating and optional comment. Only bookings with `status = completed` are eligible. The DB enforces one review per booking via a `UNIQUE` constraint on `booking_id`. Guide average rating is recomputed after each new review.

**Acceptance Criteria**
- `POST /api/reviews` creates a review (tourist auth required); returns `403` if the booking is not `completed` or doesn't belong to the caller; returns `409` if a review already exists for that booking
- `GET /api/posts/{post_id}/reviews` returns all reviews for a post, paginated, newest first (public)
- `GET /api/users/{user_id}/reviews` returns all reviews received by a guide across all their posts (public)
- `rating` must be between 1 and 5 — validated by Pydantic before hitting the DB
- Reviews cannot be edited or deleted by tourists in v1

**Design / Technical Approach**

Review fields: `review_id (UUID)`, `booking_id (FK → Booking, UNIQUE)`, `rating (SMALLINT, CHECK 1–5)`, `comment (TEXT, nullable)`, `created_at`.

`guide_id` and `post_id` are not stored on `Review` — they are derived via `Review → Booking → slot_id → post_id → user_id` in queries. For the list endpoints, these joins are straightforward.

Eligibility check:
```python
booking = db.scalar(
    select(Booking).where(
        Booking.booking_id == review_data.booking_id,
        Booking.tourist_id == current_user.user_id,
        Booking.status == "completed"
    )
)
if not booking:
    raise HTTPException(403, "Booking not found or not eligible for review")
```

---

## Ticket 9 — AI Search Endpoint (Google Gemini)

**Summary**
A tourist submits a plain-language query and Gemini matches it against published posts, returning ranked results with a short reason per match. Standard browse (`GET /api/posts`) remains available independently.

**Acceptance Criteria**
- `POST /api/search/ai` accepts `{ "query": "string", "city": "optional string" }` (no auth required)
- Returns up to 5 ranked `Post` objects, each with an added `match_reason` string from Gemini
- Falls back to keyword text search and sets `"ai_available": false` in the response if Gemini errors
- `GEMINI_API_KEY` read from `.env` — never hardcoded
- User query is never interpolated directly into the prompt instructions (injection mitigation)
- Response time target: under 5 seconds (Gemini Flash is fast enough for a portfolio scale)

**Design / Technical Approach**

Library: `google-generativeai`. Model: `gemini-1.5-flash` (free tier, 1,500 req/day).

Flow:
1. Fetch all published posts from DB (filtered by `city` if provided); serialize to compact JSON: `post_id, title, description, booking_fee, city`
2. Build structured prompt separating tourist input from listing data:
```
You are a tour recommendation engine. Return a JSON array of up to 5 matches from the listings below.
Each match: { "post_id": "uuid", "match_reason": "1-2 sentences" }. Rank by relevance.
Only reference post_ids from the provided list.

Tourist request:
<query>{tourist_query}</query>

Available listings:
<listings>{json_listings}</listings>
```
3. Parse Gemini's JSON response; fetch matched Post rows by UUID; attach `match_reason`; return

Service lives in `services/ai_search.py` so it can be mocked in tests independently of the router.

---

## Ticket 10 — Alembic Migrations & DB Initialization

**Summary**
Schema management via Alembic. Initial migration covers all six tables with their columns, constraints, foreign keys, and indexes as defined in `data_table.md`.

**Acceptance Criteria**
- `alembic upgrade head` runs cleanly against a fresh PostgreSQL instance
- `alembic downgrade -1` cleanly reverses the initial migration
- All constraints from `data_table.md` are present: `UNIQUE(post_id, date)` on Slot, `UNIQUE(booking_id)` on Review, `CHECK rating BETWEEN 1 AND 5`, `CHECK booking_fee >= 0`, `CHECK max_group_size >= 1`, `guide_id != tourist_id` guard
- `docker-compose` entrypoint runs `alembic upgrade head` before starting uvicorn
- `alembic revision --autogenerate` is the documented workflow for future schema changes

**Design / Technical Approach**

`alembic/env.py` imports `Base` from `app.database` and sets `target_metadata = Base.metadata`.

Indexes to create (for query performance):
- `posts.user_id` — guide's post list
- `slots.post_id`, `slots.date` — availability lookups
- `bookings.slot_id`, `bookings.guide_id`, `bookings.tourist_id` — dashboard queries
- `reviews.booking_id` (already UNIQUE, so indexed)

`UNIQUE(post_id, date)` on Slot is a named constraint so it produces a readable error:
```python
UniqueConstraint("post_id", "date", name="uq_slot_post_date")
```

Docker entrypoint:
```sh
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## Implementation Order

| # | Ticket | Depends On |
|---|--------|------------|
| 1 | Foundation & DB Setup | — |
| 2 | Authentication (JWT) | 1 |
| 3 | User Profile API | 2 |
| 4 | Post API | 3 |
| 5 | PostImage API | 4 |
| 6 | Slot API | 4 |
| 7 | Booking API | 6 |
| 8 | Review API | 7 |
| 9 | AI Search (Gemini) | 4 |
| 10 | Alembic Migrations | 1 |
