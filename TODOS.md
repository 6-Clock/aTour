# TODOS

## Seed-user data migration story for Ticket 2
**Resolved (2026-06-21, `/plan-eng-review` for Ticket 2):** keep the seed user as a permanent demo/fixture account — it's a real, valid `User` row with a real (throwaway) bcrypt hash. No migration/reassignment/wipe needed. Remove this item once Ticket 2 actually ships.
**What:** Decide and document what happens to posts created by the fake seed user (from the spine PR) once real auth lands — reassign ownership, keep the seed user as a permanent demo/fixture account, or wipe the data before Ticket 2 ships.
**Why:** Undefined right now. Once real users exist and may reference this data (or once it's just sitting there confusing a query), it becomes a one-way door — better to decide before Ticket 2's migration, not during it.
**Context:** The seed user is created by `backend/scripts/seed.py` with a throwaway bcrypt hash. Surfaced by the outside-voice review in `/plan-eng-review` on 2026-06-20.
**Depends on:** Ticket 2 (JWT auth) starting.

## Split app/main.py before adding auth (Ticket 2)
**Resolved (2026-06-21):** both commits landed — commit 1 (the structural split into `models/`, `schemas/`, `routers/`, `services/`, `dependencies.py`) tested standalone and green, then commit 2 (real PyJWT-based `get_current_user`, `/api/auth/register` + `/api/auth/login`, ownership check on publish) built on top. Full suite (20 tests) + ruff green at each gate.
**Context:** Decided in `/plan-eng-review` on 2026-06-20 (tension point T4).

## Frontend has no auth UI — create-post form will 401
**Resolved (2026-06-22, FE slices 1+2):** Slice 1 — auth foundation: `auth/token.ts` (localStorage-backed JWT store), `api.ts` injects `Authorization: Bearer` on every request via a shared `request()` helper, `AuthProvider`/`useAuth` context, `AuthForm` (login + register) wired to `/api/auth/*`, `react-router-dom` routing, `CreatePostForm` gated behind login (no longer 401s). Slice 2 — tourist booking flow: `PostList` links to `PostDetail` (`/posts/:postId`, shows images + future/open slots + Book), booking surfaces backend 409/401, and `MyBookings` (`/bookings`) lists `?as=tourist` bookings with cancel. Slice 3 — guide dashboard (`/me/posts`): `GuideListings` (own posts incl. hidden, publish/unpublish) with `ManageSlots` (add/open-close/delete dates), and `GuideBookings` (`?as=guide`: confirm → complete → cancel lifecycle). The app is now usable end-to-end for both roles (tourist: register → browse → book → cancel; guide: create → manage dates → confirm/complete bookings). 17 FE tests green (tsc/lint clean). Remove this item next cleanup. Per design doc `artur-B1-design-20260622-122213.md`, the **reviews-writing UI** is the remaining follow-up (now unblocked — the complete action makes bookings reviewable).
**What:** `frontend/src/components/CreatePostForm.tsx` posts to `/api/posts` with no `Authorization` header. Since Ticket 2 landed, that endpoint now requires a valid JWT — the existing form will get a 401 until a login/register UI and token storage strategy are built.
**Why:** Ticket 2's scope was backend-only by explicit decision (frontend auth UI deferred to a future phase). Flagging so this doesn't look like a regression when next picked up.
**Context:** Surfaced while landing Ticket 2 commit 2, 2026-06-21.
**Depends on:** Nothing blocking — next natural step after Ticket 2.

## Token revocation / "log out everywhere" story
**What:** Add a token revocation/blocklist path (or at minimum a documented "log out everywhere" story) once there's a real reason to need it.
**Why:** A leaked or compromised JWT is valid until it expires (30 min, per Ticket 2's locked decision), with no way to invalidate it early. Acceptable for a learning project's current stage, not for a real production auth system.
**Context:** Surfaced by the outside-voice review in `/plan-eng-review` for Ticket 2, 2026-06-21. Explicitly out of scope for Ticket 2 itself (no refresh tokens, no revocation mechanism).
**Depends on:** Nothing blocking — revisit before any real users' data is genuinely at stake.

## Wire real avg_rating query when Review API (Ticket 8) lands
**Resolved (2026-06-21, Ticket 8):** `get_public_profile` in `app/services/users.py` now computes `AVG(Review.rating)` joined `Review → Booking` where `Booking.guide_id = user_id` and builds the `UserPublic` response with the real value (None when a guide has no reviews). Covered by `test_reviews.py::test_avg_rating_none_without_reviews` and `::test_avg_rating_reflects_reviews`. Remove this item next cleanup.
**What:** In `app/services/users.py`, replace the `avg_rating = None` placeholder on the public-profile response with the real query: `AVG(Review.rating)` joined `Review → Booking` where `Booking.guide_id = user_id`.
**Why:** Ticket 3 ships `avg_rating` as `null` because `Review`/`Booking` models don't exist yet (only `User`/`Post` are built). The response field and its `float | None` type are already in place, so this is a service-layer swap, not a contract change. If skipped, guide profiles keep showing `null` forever even after reviews exist — a silent gap, since tests pass with `null` and nothing across tickets links Review API back to the profile endpoint.
**Context:** Decided in `/plan-eng-review` for Ticket 3 on 2026-06-21 (Architecture Issue 1). The null placeholder gets an inline comment in `services/users.py` pointing here.
**Depends on:** Ticket 8 (Review API) — needs `Review` and `Booking` models + data.

## No way to mark a booking `completed` (Ticket 8 needs it)
**Resolved (2026-06-21, Ticket 8):** added a guide-only `POST /api/bookings/{id}/complete` (`confirmed → completed`, else 422; 403 for non-guide) — the chosen completion trigger (user-confirmed over the auto-after-slot-date alternative). `completed` is terminal (cancel rejects it). A scheduled auto-complete job remains a possible future enhancement but is no longer blocking. Covered by `test_bookings.py` complete-transition tests. Remove this item next cleanup.
**What:** Ticket 7 builds `pending -> confirmed/cancelled`, but nothing transitions a booking to `completed`. The ticket defers completion to "manual or a future background job after the slot date passes." Add a completion mechanism (a guide-only `POST /api/bookings/{id}/complete`, or a scheduled job that completes confirmed bookings whose slot date has passed).
**Why:** Ticket 8 (Review API) only lets tourists review bookings with `status = completed`. Without any path to `completed`, no review can ever be created, and Ticket 8's tests would have to force the status directly in the DB. Decide the completion trigger before/with Ticket 8.
**Context:** Surfaced while building Ticket 7 on 2026-06-21. `BookingStatus.completed` exists in the enum and the model's lifecycle diagram notes it's unreachable via current endpoints.
**Depends on:** Blocks Ticket 8 (Review API).

## Max-5-posts enforcement has a TOCTOU race
**What:** The "max 5 posts per user" guard in `create_post` is an app-layer count-then-insert (`SELECT count … ; if >= 5 raise 409; else INSERT`). Two concurrent POSTs at 4 existing posts can both pass the count check and both insert, yielding 6 posts. Harden with a DB-level guard (partial unique/check, a trigger, or `SELECT … FOR UPDATE`) when concurrency actually matters.
**Why:** `data_table.md` and Ticket 4 explicitly mandate app-layer enforcement over a DB constraint, so the race is accepted at the current portfolio scale (a single user rarely fires concurrent creates). Capturing it keeps the "max 5" invariant an intentional tradeoff rather than a silent gap that breaks under parallel retries or scale.
**Context:** Surfaced by the outside-voice pass in `/plan-eng-review` for Ticket 4 on 2026-06-21. Explicitly accepted for now per the ticket's app-layer mandate.
**Depends on:** Nothing blocking — revisit if/when create concurrency becomes real.

## Rewrite mdreference/Setup.md
**What:** Rewrite `Setup.md` to match the current stack and schema — it still describes Expo/React Native (actual frontend is Vite/React web), an old 7-table `guides`/`tourists`/`experiences`/`categories` schema (current schema is the 6-table `User`/`Post`/... in `data_table.md`), and AWS S3/SES (dropped entirely in favor of Supabase + Vercel).
**Why:** A stale setup doc actively misleads — following it installs the wrong dependencies and sets the wrong expectations for the schema.
**Context:** Surfaced during `/office-hours` on 2026-06-20. Pure docs cleanup, not touched by the spine PR's code changes.
**Depends on:** Nothing — can be done any time, independently of the backend work.
