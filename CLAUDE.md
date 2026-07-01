# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**aTour** — an AI-powered tour marketplace. Local guides post experiences (street food walks, hikes, market tours); tourists search, book, and review them. Gemini powers natural-language search.

Full spec lives in `mdreference/` (`backend-tickets.md` for the 10-ticket backend plan, `data_table.md` for the relational schema). These are the *original* plan, not the current truth — the code + `TODOS.md` + `passSession/` are. Notably `data_table.md`'s slot-capacity model is out of date (see Booking below). `TODOS.md` tracks deferred work and intentional deviations; `passSession/` holds dated session summaries.

**Current state:** feature-complete v1. **All 10 backend tickets are built and tested** (138 pytest) — JWT auth, User/Post/PostImage/Slot/Booking/Review APIs, and Gemini AI search. The **frontend is a full product loop** (55 Vitest tests): register/login, browse, post detail with booking, "my bookings" + reviews, a guide dashboard (manage posts, slots, and bookings), and **Supabase image upload** (create-flow image step + guide dashboard `ManageImages`). What remains is account matters (Gemini billing, Supabase bucket public toggle), see `TODOS.md`.

**Booking model (changed from the spec):** booking a slot sets `slot.available = False`, so a date is bookable by exactly **one** tourist (a second attempt gets `409`); cancelling reopens it. This replaced `data_table.md`'s `max_group_size`-capacity model — `max_group_size` is now just the tour's group size, not a concurrency cap. See `TODOS.md`.

## Stack

- **Backend:** FastAPI + SQLAlchemy 2.0 (typed `Mapped`/`mapped_column`, `DeclarativeBase`) + PostgreSQL + Alembic migrations. `bcrypt` directly for password hashing (not `passlib` — it's unmaintained and broken by `bcrypt>=5.0.0`, despite what `backend-tickets.md`'s stack notes say).
- **Frontend:** React 19 + TypeScript + Vite + React Router. Auth via a token store + `AuthContext` (`src/auth/`); `src/api.ts` is the single fetch wrapper that injects the JWT and maps non-2xx to `ApiError`. JWT in `localStorage`; no styling framework (hand-rolled CSS in `index.css` + `App.css`). Supabase Storage wired via `src/supabase.ts` (anon key, direct client-side upload); `ManageImages` component handles upload/delete/reorder for both the create flow and guide dashboard.
- **Tests:** pytest (backend, `httpx`/`TestClient`) + Vitest + React Testing Library (frontend).
- **Local dev:** Docker Compose runs Postgres only — backend (`uvicorn`) and frontend (`vite`) run directly on the host, not containerized. `DATABASE_URL` in `backend/.env` points at `localhost:5432`, not a `db` container hostname.
- **Deferred:** Vercel (frontend deploy) is the planned production target, not wired up yet. AWS is explicitly out — dropped in favor of Supabase. Supabase Storage is live; bucket must be set to **Public** in the Supabase Dashboard for images to load on the public PostDetail page.

## Repository Structure

Backend follows a **service/router/schema split per resource** (routers stay thin; business logic in services):

- `backend/app/` — `main.py` (app + router registration), `database.py` (engine/session/`Base`), `dependencies.py` (`get_db`, `get_current_user`, `get_current_user_optional`)
  - `models/` — `user`, `post`, `post_image`, `slot`, `booking`, `review` (all must be imported in `models/__init__.py` for Alembic to see them)
  - `schemas/` — Pydantic request/response models per resource (incl. `search`)
  - `routers/` — `auth`, `users`, `posts`, `images`, `slots`, `bookings`, `reviews`, `search` (some files export extra nested routers, e.g. `post_reviews_router`, registered in `main.py`)
  - `services/` — business logic incl. `ai_search.py` (Gemini call isolated in `rank_with_gemini` for mocking; keyword fallback)
- `backend/alembic/versions/` — migration chain (6 migrations through the index migration)
- `backend/scripts/seed.py` — idempotent seed user; run after `alembic upgrade head`
- `backend/tests/` — `conftest.py` (fixtures: `client`, `auth_headers`, `make_user`, `make_post`) + one `test_*.py` per area
- `frontend/src/` — `App.tsx` (header + routes), `api.ts` (fetch wrapper), `supabase.ts` (Supabase client, anon key), `auth/` (token store + `AuthContext`/`useAuth`), `components/` (forms + pages: auth, posts, post detail, my bookings, guide dashboard, reviews; `ManageImages` handles Supabase image upload/delete/reorder), `index.css` + `App.css` (design system)

## Running Locally

```bash
docker compose up -d                          # Postgres only
cd backend && .\venv\Scripts\activate
alembic upgrade head && python -m scripts.seed
uvicorn app.main:app --reload --port 8000     # http://localhost:8000/docs

cd frontend && npm run dev                    # http://localhost:5173
```

## Testing

```bash
# backend/, venv active, Postgres up
pytest tests -v
ruff check .

# frontend/
npm test
npm run lint
npx tsc -b --noEmit
```

## Database migrations

Alembic against `app.database.Base` (`alembic/env.py` imports `app.database` + `app.models`, so every model must be imported in `app/models/__init__.py` to be seen).

```bash
# backend/, venv active, Postgres up
alembic upgrade head            # apply all migrations
alembic downgrade -1            # reverse the latest
alembic revision --autogenerate -m "describe change"   # after editing models
```

Workflow: edit the model → `--autogenerate` → **review the generated file** before applying (autogenerate misses enum drops on downgrade and won't reorder data-dependent steps). Every migration must have a working `downgrade` — verify with a `downgrade -1` / `upgrade head` cycle. Migrations carry the schema constraints (UNIQUE, CHECKs, the `guide_id != tourist_id` guard) and the FK performance indexes; `reviews.booking_id` is indexed via its UNIQUE.

## Environment

Secrets and configuration go in `.env` (git-ignored, one in `backend/` and one in `frontend/`). Never commit `.env`. `frontend/.env` only exposes vars prefixed `VITE_` to client code — never put secrets there, it ends up in the JS bundle. Backend env vars: `DATABASE_URL`, `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `SEED_USER_EMAIL`, `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-2.0-flash`), `AI_SEARCH_ENABLED` (set `false` to disable Gemini and serve keyword-only search). Frontend env vars: `VITE_API_BASE_URL` (backend URL), `VITE_SUPABASE_URL` (project URL, no path — e.g. `https://xyz.supabase.co`), `VITE_SUPABASE_ANON_KEY` (public anon key).

## Branch Strategy

Branch protection is configured on `main`. Work on feature branches and open PRs to merge.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
