# TODOS

## Seed-user data migration story for Ticket 2
**What:** Decide and document what happens to posts created by the fake seed user (from the spine PR) once real auth lands — reassign ownership, keep the seed user as a permanent demo/fixture account, or wipe the data before Ticket 2 ships.
**Why:** Undefined right now. Once real users exist and may reference this data (or once it's just sitting there confusing a query), it becomes a one-way door — better to decide before Ticket 2's migration, not during it.
**Context:** The seed user is created by `backend/scripts/seed.py` with a throwaway bcrypt hash. Surfaced by the outside-voice review in `/plan-eng-review` on 2026-06-20.
**Depends on:** Ticket 2 (JWT auth) starting.

## Split app/main.py before adding auth (Ticket 2)
**What:** When starting Ticket 2, do the structural split (flat `app/main.py` → `models/`, `schemas/`, `routers/`, `services/`, `dependencies.py`) as its own first commit, then implement JWT auth as a second commit on top of the split structure.
**Why:** The spine PR deliberately stayed flat (one table, fewer concepts to learn at once). Ticket 2's spec assumes the layered structure already exists. Keeping the refactor and the feature change as separate commits avoids one tangled diff that's hard to review or revert.
**Context:** Decided in `/plan-eng-review` on 2026-06-20 (tension point T4) — the flat structure was accepted on the explicit understanding that Ticket 2 pays for the split.
**Depends on:** The spine PR (Ticket 1a: User + Post) landing first.

## Rewrite mdreference/Setup.md
**What:** Rewrite `Setup.md` to match the current stack and schema — it still describes Expo/React Native (actual frontend is Vite/React web), an old 7-table `guides`/`tourists`/`experiences`/`categories` schema (current schema is the 6-table `User`/`Post`/... in `data_table.md`), and AWS S3/SES (dropped entirely in favor of Supabase + Vercel).
**Why:** A stale setup doc actively misleads — following it installs the wrong dependencies and sets the wrong expectations for the schema.
**Context:** Surfaced during `/office-hours` on 2026-06-20. Pure docs cleanup, not touched by the spine PR's code changes.
**Depends on:** Nothing — can be done any time, independently of the backend work.
