# TODOS

## Booking model changed: one booking per date (was capacity-based)
**What:** Per product decision (2026-06-22), booking a slot now sets `slot.available = False` so a date is bookable by exactly **one** tourist; a second attempt (any user, incl. the same one) gets `409 "this date is already booked"`. Cancelling reopens the date. This replaced the original `data_table.md` / Ticket 6-7 model where a slot held up to `max_group_size` concurrent bookings.
**Why:** Fixes the reported bug (a user could book the same date repeatedly) and matches the desired "booking closes the date" behavior. `max_group_size` is now informational (the tour's group size), not a concurrency cap. The capacity count check + `_active_booking_count` helper were removed from `services/bookings.py`.
**How to apply (if reverting to capacity):** re-add the count-vs-`max_group_size` guard and drop the `slot.available` flip on book/cancel. `mdreference/data_table.md` still describes the capacity model and is now out of date on this point.
**Context:** `services/bookings.py` (`create_booking`/`cancel_booking`); tests in `test_bookings.py` (`test_booking_closes_the_slot`, `test_second_tourist_cannot_book_taken_date`, `test_cancel_reopens_the_date`).
**Depends on:** Nothing — shipped and tested.

## Gemini billing credits depleted (AI search always falls back until topped up)
**What:** Ticket 9's `/api/search/ai` is built and correct, but a live call with the configured `GEMINI_API_KEY` returns `429 RESOURCE_EXHAUSTED` — "Your prepayment credits are depleted." So the endpoint currently always degrades to keyword search (`ai_available: false`). Key + SDK + model (`gemini-2.0-flash`) are all valid (the request reached the billing check, not auth/model/quota-config error).
**Why:** Until the key's Google project has a positive prepaid balance (or billing method), AI ranking never runs. The fallback keeps the endpoint working, so this is a capability gap, not a crash.
**How to apply:** Top up / fix billing at AI Studio (https://ai.studio/projects), then verify with a live `rank_with_gemini` call. No code change needed (model is also env-overridable via `GEMINI_MODEL` if desired). Meanwhile, set `AI_SEARCH_ENABLED=false` in `backend/.env` to skip Gemini entirely (keyword-only, no API calls/429s); set back to `true` once billing is sorted.
**Context:** Surfaced by live smoke tests while building Ticket 9 on 2026-06-22 (first reported as free-tier `limit: 0`, then as depleted prepay credits).
**Depends on:** Nothing in code — it's an account/billing matter.

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
**Resolved (2026-06-22, FE slices 1+2):** Slice 1 — auth foundation: `auth/token.ts` (localStorage-backed JWT store), `api.ts` injects `Authorization: Bearer` on every request via a shared `request()` helper, `AuthProvider`/`useAuth` context, `AuthForm` (login + register) wired to `/api/auth/*`, `react-router-dom` routing, `CreatePostForm` gated behind login (no longer 401s). Slice 2 — tourist booking flow: `PostList` links to `PostDetail` (`/posts/:postId`, shows images + future/open slots + Book), booking surfaces backend 409/401, and `MyBookings` (`/bookings`) lists `?as=tourist` bookings with cancel. Slice 3 — guide dashboard (`/me/posts`): `GuideListings` (own posts incl. hidden, publish/unpublish) with `ManageSlots` (add/open-close/delete dates), and `GuideBookings` (`?as=guide`: confirm → complete → cancel lifecycle). The app is now usable end-to-end for both roles (tourist: register → browse → book → cancel; guide: create → manage dates → confirm/complete bookings). Slice 4 — reviews UI: `ReviewForm` on completed bookings (`POST /api/reviews`, 409 = already reviewed), reviews list + guide `avg_rating` on `PostDetail` (`getUser` + `listPostReviews`). The v1 product loop is now feature-complete for both roles. 19 FE tests green (tsc/lint clean). **This item is fully resolved — safe to delete.** Remaining project work is backend-only: Ticket 9 (Gemini AI search) and Ticket 10 (Alembic finalization).
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

## Reels `/discover` feed pagination / infinite scroll
**What:** The `/discover` reels feed (feature sweep, PR4) reuses `GET /api/posts`, which defaults to `limit=20`. v1 ships the first 20 published posts only. Add infinite scroll (offset paging, already supported by `list_posts`) and possibly feed ranking once the published-post count regularly exceeds 20.
**Why:** A reels-style feed implies "keep swiping." Capping at 20 silently hides tours past the first page. Deferred because at current scale there are far fewer than 20 published posts, so paging adds complexity with no user-visible benefit yet.
**Pros:** Full catalog browsable by swipe; sets up ranking/personalization later.
**Cons:** Infinite-scroll state + intersection-observer wiring; ranking is a separate design question.
**Context:** Surfaced in `/plan-eng-review` for the feature sweep on 2026-06-22. `list_posts` (`services/posts.py:105`) already accepts `limit`/`offset`, so the backend is ready; this is mostly frontend scroll wiring. Start in `Discover.tsx` (PR4) once it exists.
**Depends on:** PR4 (reels feed) landing first.

## Supabase Storage: upgrade bucket security for production
**What:** The image upload bucket uses an open INSERT policy (any anon key bearer can upload to any path, including other guides' folders). Path convention `{user_id}/{post_id}/...` organizes files but does not cryptographically enforce ownership.
**Why:** The app uses a custom FastAPI JWT, not Supabase Auth, so `auth.uid()` is always null in RLS — per-user RLS via Supabase's standard patterns doesn't work without using Supabase Auth or a proxy.
**Pros:** Prevents cross-user path pollution in production; signed URLs also enable upload expiry and audit trails.
**Cons:** Requires either (a) a new backend endpoint that verifies ownership and issues a Supabase presigned upload URL using the service_role key, or (b) a Supabase Edge Function to validate the aTour JWT. Non-trivial change.
**Context:** Surfaced by `/plan-eng-review` on 2026-06-25 (Supabase image storage plan, D3). Accepted as-is for portfolio scope. Revisit before any public/production launch.
**Depends on:** Supabase Storage integration landing first.

## Create flow: communicate to guide that abandoned drafts are recoverable
**What:** After a guide creates a listing and enters the image-step, if they close the tab or navigate away, the `posted: false` draft still exists — but the guide has no in-app signal that it's saved. Add a note in the image-step UI, e.g. a muted line below the heading: "Draft saved — find it in your dashboard if you close this page."
**Why:** The guide dashboard (`/me/posts`) already shows all hidden posts with a "Publish" button. But a guide who closes the tab mid-flow might not know to look there, and may re-create the listing thinking it was lost. No functional bug — just an undiscoverable recovery path.
**Pros:** Zero confusion about abandoned drafts; guides confident to close and return later.
**Cons:** Very small UI copy change; the value is low until there are real guides reporting confusion.
**Context:** Surfaced by outside-voice review in `/plan-eng-review` on 2026-06-25 (create flow image upload). `GuideListings.tsx` already calls `listUserPosts` and shows both published and hidden posts. No backend change needed — pure UI copy.
**Depends on:** Create flow image upload (B1) landing first.

## Supabase Storage: client-side image resize before upload
**What:** No compression or resizing happens before files reach Supabase Storage. Guides can upload 4K photos (up to the 5MB cap), which makes carousel loads slow and increases Supabase egress costs at scale.
**Why:** Large unoptimized images degrade the tourist experience — the PostDetail carousel loads each image at full resolution.
**Pros:** Faster carousel loads; lower Supabase egress; better mobile experience.
**Cons:** Adds canvas resize logic in ManageImages.tsx, or requires using Supabase Image Transformations URL params (`?width=1920&quality=80`). Supabase Transform is the simpler path (zero client code) but costs extra on paid plans.
**Context:** Surfaced by `/plan-eng-review` on 2026-06-25 (Supabase image storage plan). Deferred because the 5MB client-side cap already blocks the worst cases.
**Depends on:** Supabase Storage integration landing first.
