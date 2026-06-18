# aTour — Backend API Tickets

> Stack in use: **FastAPI + SQLAlchemy 2.0 + PostgreSQL + JWT (python-jose) + Google Gemini + Alembic + Docker Compose**
>
> **Stack notes vs. original spec:**
> - `python-jose[cryptography]` + `passlib[bcrypt]` replace the generic "JWT" reference — these are the FastAPI-standard libraries for JWT auth and password hashing.
> - `Alembic` is added for database migrations — absent from the spec but non-negotiable for any schema that will evolve.
> - `google-generativeai` (official Python SDK) handles Gemini calls instead of raw HTTP.
> - OAuth (Google social login) is scoped out of v1 — email/password JWT is the auth layer here. Social login can be added later with `authlib`.
> - "React Native + Vite" in the spec is contradictory (RN is mobile, Vite is a web bundler). Frontend stays as React + Vite (web). Mobile is out of scope for this version.

---

## Ticket 1 — Project Foundation & Database Setup

**Summary**
Rebuild the backend from the current contacts-CRUD skeleton into the aTour domain. Set up Docker Compose with FastAPI and PostgreSQL, configure Alembic for migrations, wire up SQLAlchemy, and define all seven core models. This is the prerequisite for every other ticket.

**Acceptance Criteria**
- `docker-compose up` starts a FastAPI container and a PostgreSQL container with no manual steps
- `GET /health` returns `{ "status": "ok" }` and confirms DB connectivity
- All seven SQLAlchemy models are defined: `Guide`, `Experience`, `Category`, `Availability`, `Tourist`, `Booking`, `Review`
- Alembic is configured; `alembic upgrade head` applies all migrations cleanly from scratch
- `DATABASE_URL` and other secrets are read from `.env` — no hardcoded values
- Existing `examplefastapi.py` and contacts code are removed or isolated so they don't ship in production

**Design / Technical Approach**

```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, router registration
│   ├── database.py          # engine, SessionLocal, Base
│   ├── models/
│   │   ├── guide.py
│   │   ├── experience.py
│   │   ├── availability.py
│   │   ├── tourist.py
│   │   ├── booking.py
│   │   └── review.py
│   ├── schemas/             # Pydantic v2 request/response models
│   ├── routers/             # one file per domain
│   ├── services/            # business logic, keeps routers thin
│   └── dependencies.py      # get_db, get_current_user
├── alembic/
├── alembic.ini
├── requirements.txt
└── Dockerfile
```

Key model relationships:
- `Guide` 1→N `Experience`
- `Experience` 1→N `Availability`, 1→N `Review`
- `Tourist` 1→N `Booking`
- `Booking` N→1 `Availability`, 1→1 `Review`

`docker-compose.yml` services: `db` (postgres:16-alpine), `api` (python:3.12-slim, depends_on db).

---

## Ticket 2 — Authentication (JWT, Guide + Tourist roles)

**Summary**
Implement email/password registration and login for both user types (Guide and Tourist) using JWT access tokens. Role is embedded in the token payload so protected routes can enforce guide-only or tourist-only access without an extra DB lookup.

**Acceptance Criteria**
- `POST /api/auth/guide/register` creates a Guide, returns a JWT
- `POST /api/auth/tourist/register` creates a Tourist, returns a JWT
- `POST /api/auth/login` accepts email + password, detects role automatically, returns a JWT
- Passwords are hashed with bcrypt — plaintext is never stored
- JWT payload includes `sub` (user id), `role` (`guide` | `tourist`), and `exp`
- `401 Unauthorized` is returned for invalid credentials or expired tokens
- A `get_current_user` FastAPI dependency resolves the token and injects the user on protected routes
- A `require_role("guide")` dependency raises `403` if the wrong role calls a protected endpoint

**Design / Technical Approach**

Libraries: `python-jose[cryptography]`, `passlib[bcrypt]`.

```python
# dependencies.py
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = jose.jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    role, user_id = payload["role"], payload["sub"]
    # fetch from Guide or Tourist table based on role
    ...
```

Token structure:
```json
{ "sub": "42", "role": "guide", "exp": 1751234567 }
```

`SECRET_KEY` and `ACCESS_TOKEN_EXPIRE_MINUTES` come from `.env`. No refresh tokens in v1 — add later if needed.

---

## Ticket 3 — Guide Profile API

**Summary**
Guides are the supply side of the marketplace. This ticket covers everything a guide needs to manage their public-facing identity: creating a profile on registration, viewing it, and editing it. Profile data feeds the listing pages and the AI search context.

**Acceptance Criteria**
- `GET /api/guides/{guide_id}` returns a guide's public profile (no auth required)
- `GET /api/guides/` returns a paginated list of all guides
- `PUT /api/guides/me` allows an authenticated guide to update their own profile
- `GET /api/guides/me` returns the authenticated guide's full profile (includes private fields like email)
- A guide cannot edit another guide's profile — `403` is returned if they try
- Profile fields: `photo_url`, `bio`, `languages` (array), `city`, `country`, `avg_rating` (computed), `created_at`

**Design / Technical Approach**

Router: `routers/guides.py`. All write endpoints are protected with `Depends(require_role("guide"))`.

`avg_rating` is not stored — it is computed from the `Review` table via a SQLAlchemy `column_property` or a service-layer query so it stays in sync automatically.

`photo_url` is a string pointing to a Supabase Storage URL; file upload is handled separately (out of scope for v1 — accept a URL string for now).

---

## Ticket 4 — Experience (Listing) API

**Summary**
Experiences are what tourists browse and book. A guide can create multiple listings (street food walk, sunset hike, etc.) and manage them. This ticket covers the full CRUD surface for experiences plus the public browse endpoint tourists use.

**Acceptance Criteria**
- `POST /api/experiences` creates a new experience (guide auth required)
- `GET /api/experiences/{experience_id}` returns full experience detail (public)
- `PUT /api/experiences/{experience_id}` updates an experience (owner guide only)
- `DELETE /api/experiences/{experience_id}` soft-deletes an experience (owner guide only) — does not cascade-delete past bookings
- `GET /api/experiences` returns a paginated, filterable list (public); supports query params: `city`, `category`, `max_price`, `min_duration`, `max_duration`
- `GET /api/guides/{guide_id}/experiences` returns all experiences for a specific guide (public)
- A guide cannot modify another guide's experience — `403` is returned

**Design / Technical Approach**

Experience fields: `title`, `description`, `price` (Decimal), `duration_hours` (Float), `max_group_size` (Integer), `category_id` (FK), `city`, `cover_image_url`, `is_active` (soft delete flag), `guide_id` (FK), `created_at`.

Filtering on `GET /api/experiences` is handled via SQLAlchemy `.filter()` chains in the service layer — not raw SQL. Use `select()` syntax (SQLAlchemy 2.0 style).

Soft delete: set `is_active = False`. All list queries filter `where is_active = true` by default. Add `?include_inactive=true` for admin use later.

---

## Ticket 5 — Availability API

**Summary**
Each experience has a set of available dates and a remaining capacity. Guides publish their open slots; tourists pick one when booking. This ticket handles the availability lifecycle from creation through capacity tracking.

**Acceptance Criteria**
- `POST /api/experiences/{experience_id}/availability` adds one or more date slots (guide auth, owner only)
- `GET /api/experiences/{experience_id}/availability` returns all future available slots for a given experience (public); past slots are excluded
- `DELETE /api/availability/{availability_id}` removes a slot (guide auth, owner only) — only allowed if no confirmed bookings exist for that slot
- `spots_remaining` is a computed field: `max_group_size - confirmed_booking_count`
- Slots with `spots_remaining == 0` are returned with `is_full: true` but still visible

**Design / Technical Approach**

Availability fields: `experience_id` (FK), `date` (Date), `start_time` (Time), `spots_remaining` (Integer, decremented on booking confirm), `created_at`.

`spots_remaining` is updated transactionally when a booking is confirmed or cancelled to avoid race conditions — use `SELECT ... FOR UPDATE` (SQLAlchemy `with_for_update()`).

Bulk creation: `POST /api/experiences/{id}/availability` accepts a list of date objects so guides can add a whole week at once.

---

## Ticket 6 — Tourist Profile API

**Summary**
Tourists are the demand side. They need a lightweight profile to authenticate, make bookings, and leave reviews. This ticket is intentionally minimal — tourists don't have public-facing pages in v1.

**Acceptance Criteria**
- `GET /api/tourists/me` returns the authenticated tourist's profile
- `PUT /api/tourists/me` allows a tourist to update their name and profile photo URL
- `DELETE /api/tourists/me` deactivates the account (`is_active = False`) — does not delete past bookings
- A tourist cannot access another tourist's profile — the `/me` pattern enforces this by design

**Design / Technical Approach**

Tourist fields: `email`, `password_hash`, `first_name`, `last_name`, `photo_url`, `is_active`, `created_at`.

No public list endpoint for tourists — their data is private. The only cross-entity exposure is the reviewer's first name on a `Review` response object.

---

## Ticket 7 — Booking API

**Summary**
Bookings are the transactional core of the platform. A tourist selects an availability slot, confirms, and the guide is notified. Capacity is decremented. Cancellation is supported within policy rules.

**Acceptance Criteria**
- `POST /api/bookings` creates a booking in `pending` status (tourist auth required)
- `POST /api/bookings/{booking_id}/confirm` transitions status to `confirmed` and decrements `spots_remaining` (can be triggered by guide or auto-confirm — v1 auto-confirms)
- `POST /api/bookings/{booking_id}/cancel` cancels a booking and restores `spots_remaining` (tourist or guide can cancel)
- `GET /api/bookings/{booking_id}` returns booking detail (accessible by the tourist who made it or the experience's guide)
- `GET /api/bookings/my` returns all bookings for the authenticated user (works for both tourist and guide, filtered by role)
- Booking a full slot (`spots_remaining == 0`) returns `409 Conflict`
- Status transitions: `pending → confirmed → completed` or `pending/confirmed → cancelled`

**Design / Technical Approach**

Booking fields: `tourist_id` (FK), `availability_id` (FK), `status` (Enum: pending/confirmed/cancelled/completed), `group_size` (Integer, default 1), `total_price` (Decimal, snapshot at booking time), `created_at`.

`total_price` is snapshotted at booking time (not linked to the live experience price) so price changes don't affect past bookings.

v1 uses auto-confirm: `POST /api/bookings` immediately sets status to `confirmed` and decrements spots in one transaction. Guide notification is a log statement for now — add email/webhook in v2.

`completed` status is set via a background job or cron after `availability.date` has passed (out of scope v1 — set manually or leave as confirmed).

---

## Ticket 8 — Reviews API

**Summary**
After an experience, tourists leave a star rating and short text review. This is the trust layer. Guide profiles display their average rating. Reviews are tied to a specific booking to prevent spam.

**Acceptance Criteria**
- `POST /api/reviews` creates a review (tourist auth required); the tourist must have a `confirmed` or `completed` booking for that experience
- A tourist can only review the same experience once — `409` if they try again
- `GET /api/experiences/{experience_id}/reviews` returns all reviews for an experience (public), paginated, sorted by `created_at` desc
- `GET /api/guides/{guide_id}/reviews` returns all reviews across a guide's experiences (public)
- Guide `avg_rating` updates automatically after a new review is posted
- Reviews cannot be edited or deleted by tourists — only an admin can remove them (admin role is out of scope v1, endpoint can be stubbed)

**Design / Technical Approach**

Review fields: `booking_id` (FK, unique — one review per booking), `experience_id` (FK), `tourist_id` (FK), `guide_id` (FK, denormalized for query efficiency), `rating` (Integer, 1–5, validated in Pydantic), `comment` (Text, optional), `created_at`.

`avg_rating` on the Guide model: recomputed in the service layer after each new review via `SELECT AVG(rating) FROM reviews WHERE guide_id = ?` and written back to `guides.avg_rating`. This is a simple write-through cache — acceptable at this scale.

Eligibility check before creating a review:
```python
booking = db.query(Booking).filter(
    Booking.tourist_id == current_user.id,
    Booking.availability.has(experience_id=experience_id),
    Booking.status.in_(["confirmed", "completed"])
).first()
if not booking:
    raise HTTPException(403, "You must have a completed booking to review this experience")
```

---

## Ticket 9 — AI Search Endpoint (Google Gemini)

**Summary**
The AI search endpoint is aTour's differentiator. A tourist submits a plain-language query ("something outdoorsy for two people under $50 in Lisbon") and Gemini reads the available listings and returns ranked matches with a short reason for each. Standard browse still exists independently.

**Acceptance Criteria**
- `POST /api/search/ai` accepts `{ "query": "string", "city": "optional string" }` (no auth required)
- Returns up to 5 ranked `Experience` objects, each with an added `match_reason` string from Gemini
- If Gemini is unavailable or returns an error, falls back gracefully to a keyword-based text search and sets `ai_available: false` in the response
- Response time target: under 5 seconds (Gemini Flash is fast enough; index `city` and `category` on the DB)
- `GEMINI_API_KEY` is read from `.env` — never hardcoded
- Prompt injection in the query string is mitigated by sending listings as a structured data block, not interpolating raw user input into instructions

**Design / Technical Approach**

Library: `google-generativeai` (official Python SDK). Model: `gemini-1.5-flash` (free tier, 1,500 req/day — sufficient for a portfolio project).

Flow:
1. Fetch all active experiences from DB (filtered by `city` if provided) — serialize to a compact JSON list (id, title, description, price, duration, category, city)
2. Build a structured prompt:
```
You are a tour recommendation engine. Given the tourist's request and the listings below, return a JSON array of up to 5 matches. Each match: { "experience_id": int, "match_reason": "1-2 sentences" }. Rank by relevance. Do not invent experiences not in the list.

Tourist request: <query>

Available listings:
<json_listings>
```
3. Parse Gemini's JSON response, fetch the matched Experience rows by ID, attach `match_reason`, return.

Prompt injection mitigation: user query is placed inside `<query>` tags, listings are a separate `<json_listings>` block. Gemini is instructed to only reference experiences by ID from the provided list.

Add a `routers/search.py` file. Keep the Gemini call in `services/ai_search.py` so it can be mocked in tests.

---

## Ticket 10 — Alembic Migrations & DB Initialization

**Summary**
Schema management via Alembic so the database can evolve safely as the project grows. This ticket sets up Alembic, writes the initial migration from all seven models, and documents the migration workflow.

**Acceptance Criteria**
- `alembic init alembic` is configured to read `DATABASE_URL` from `.env`
- Initial migration covers all seven tables with correct columns, types, foreign keys, and indexes
- `alembic upgrade head` runs cleanly against a fresh PostgreSQL instance
- `alembic downgrade -1` cleanly reverses the migration
- `alembic revision --autogenerate -m "description"` is the documented workflow for future schema changes
- CI (future): migration check runs before tests

**Design / Technical Approach**

`alembic/env.py` imports `Base` from `app.database` and sets `target_metadata = Base.metadata` so autogenerate works.

Indexes to create in the initial migration (for query performance):
- `experiences.city`
- `experiences.category_id`
- `experiences.guide_id`
- `availability.experience_id`, `availability.date`
- `bookings.tourist_id`, `bookings.availability_id`
- `reviews.guide_id`, `reviews.experience_id`

`docker-compose.yml` entrypoint runs `alembic upgrade head && uvicorn app.main:app` so migrations apply automatically on container start.

---

## Implementation Order

| # | Ticket | Depends On |
|---|--------|------------|
| 1 | Foundation & DB Setup | — |
| 2 | Authentication (JWT) | 1 |
| 3 | Guide Profile API | 2 |
| 4 | Experience API | 3 |
| 5 | Availability API | 4 |
| 6 | Tourist Profile API | 2 |
| 7 | Booking API | 5, 6 |
| 8 | Reviews API | 7 |
| 9 | AI Search (Gemini) | 4 |
| 10 | Alembic Migrations | 1 |
