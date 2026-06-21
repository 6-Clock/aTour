# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**aTour** — an AI-powered tour marketplace. Local guides post experiences (street food walks, hikes, market tours); tourists search and book them. Gemini-powered natural-language search is planned but not yet built.

Full spec lives in `mdreference/` (`backend-tickets.md` for the 10-ticket backend plan, `data_table.md` for the relational schema — these are the source of truth for scope/schema, not this file). `TODOS.md` tracks deferred work with context.

**Current state:** the "spine" is built and working — `User` + `Post` only, no real auth yet (a single stub/seeded user stands in for `get_current_user()`), no images/slots/bookings/reviews/AI search. Everything else in `backend-tickets.md` is still ahead. See `TODOS.md` for what's explicitly deferred and why.

## Stack

- **Backend:** FastAPI + SQLAlchemy 2.0 (typed `Mapped`/`mapped_column`, `DeclarativeBase`) + PostgreSQL + Alembic migrations. `bcrypt` directly for password hashing (not `passlib` — it's unmaintained and broken by `bcrypt>=5.0.0`, despite what `backend-tickets.md`'s stack notes say).
- **Frontend:** React 19 + TypeScript + Vite. No router yet (single `App.tsx`, swap components manually).
- **Tests:** pytest (backend, `httpx`/`TestClient`) + Vitest + React Testing Library (frontend).
- **Local dev:** Docker Compose runs Postgres only — backend (`uvicorn`) and frontend (`vite`) run directly on the host, not containerized. `DATABASE_URL` in `backend/.env` points at `localhost:5432`, not a `db` container hostname.
- **Deferred:** Supabase (storage) + Vercel (frontend deploy) are the planned production targets, not wired up yet. AWS is explicitly out — dropped in favor of Supabase.

## Repository Structure

- `backend/app/` — `main.py` (FastAPI app + routes, currently flat — not yet split into `models/`/`schemas/`/`routers/`/`services/`, see `TODOS.md`), `database.py` (engine/session/`Base`/`get_db`), `models.py` (`User`, `Post`), `schemas.py` (Pydantic request/response models)
- `backend/alembic/` — migrations; `alembic/env.py` imports `app.database`/`app.models`, so migrations only work once those exist
- `backend/scripts/seed.py` — idempotent, creates the one stand-in seed user; run after `alembic upgrade head`
- `backend/tests/` — `conftest.py` (shared fixtures: `client`, `seeded_user`), `test_smoke.py`, `test_posts_spine.py`, `test_error_handling.py`
- `frontend/src/` — `App.tsx` (root), `api.ts` (fetch wrapper), `components/CreatePostForm.tsx` + `PostList.tsx`

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

## Environment

Secrets and configuration go in `.env` (git-ignored, one in `backend/` and one in `frontend/`). Never commit `.env`. `frontend/.env` only exposes vars prefixed `VITE_` to client code — never put secrets there, it ends up in the JS bundle.

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
