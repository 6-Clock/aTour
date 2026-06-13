# aTour — Database Relational Schema

## Tables

### User
Single table for both guides and tourists — any user can post (as a guide) or book (as a tourist).

| Column | Type | Constraints |
|--------|------|-------------|
| user_id | UUID | PK, default gen_random_uuid() |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | TEXT | NOT NULL |
| name | VARCHAR(100) | NOT NULL |
| profile_photo | TEXT | nullable — S3 URL |
| bio | TEXT | nullable |
| languages | TEXT[] | nullable — PostgreSQL array |
| city | VARCHAR(100) | nullable |
| created_at | TIMESTAMP | NOT NULL, default now() |

---

### Post
A guide's listing. Max 5 posts per user enforced at the application layer (count check before INSERT).

| Column | Type | Constraints |
|--------|------|-------------|
| post_id | UUID | PK, default gen_random_uuid() |
| user_id | UUID | FK → User.user_id, ON DELETE CASCADE |
| title | VARCHAR(200) | NOT NULL |
| description | TEXT | nullable |
| booking_fee | NUMERIC(10,2) | NOT NULL, CHECK >= 0 |
| max_group_size | INT | NOT NULL, CHECK >= 1 |
| posted | BOOLEAN | NOT NULL, default false (hidden until published) |
| created_at | TIMESTAMP | NOT NULL, default now() |

---

### PostImage
Separate table to store ordered images per post (stored as S3 URLs).

| Column | Type | Constraints |
|--------|------|-------------|
| image_id | UUID | PK |
| post_id | UUID | FK → Post.post_id, ON DELETE CASCADE |
| image_url | TEXT | NOT NULL |
| display_order | INT | NOT NULL, default 0 |

---

### Slot
Represents a guide's available date for a specific post.

| Column | Type | Constraints |
|--------|------|-------------|
| slot_id | UUID | PK |
| post_id | UUID | FK → Post.post_id, ON DELETE CASCADE |
| date | DATE | NOT NULL |
| available | BOOLEAN | NOT NULL, default true |
| | | UNIQUE(post_id, date) — one slot per post per calendar day |

> `available` is a guide-controlled toggle (open/close a date). The app also checks `booking count < Post.max_group_size` before allowing a new booking.

---

### Booking
Links a tourist to a specific slot. guide_id is denormalized here for fast guide-side queries.

| Column | Type | Constraints |
|--------|------|-------------|
| booking_id | UUID | PK |
| slot_id | UUID | FK → Slot.slot_id |
| guide_id | UUID | FK → User.user_id |
| tourist_id | UUID | FK → User.user_id |
| status | ENUM | NOT NULL — `pending`, `confirmed`, `cancelled`, `completed` |
| created_at | TIMESTAMP | NOT NULL, default now() |

> Guard: `guide_id != tourist_id`

---

### Review
One review per booking (1-to-1). UNIQUE on booking_id enforces this at the DB level. Only bookings with `status = completed` are eligible.

| Column | Type | Constraints |
|--------|------|-------------|
| review_id | UUID | PK |
| booking_id | UUID | FK → Booking.booking_id, UNIQUE |
| rating | SMALLINT | NOT NULL, CHECK 1–5 |
| comment | TEXT | nullable |
| created_at | TIMESTAMP | NOT NULL, default now() |

---

## Relationships

```
User (1) ──────────< Post (many)
Post (1) ──────────< PostImage (many)
Post (1) ──────────< Slot (many)
Slot (1) ──────────< Booking (many)
User (1) ──────────< Booking (many, as guide_id)
User (1) ──────────< Booking (many, as tourist_id)
Booking (1) ───────── Review (1)
```

---

## Key Design Decisions

1. **Single User table** — no separate Guide/Tourist tables. Any user can be both. The act of owning a Post makes you a guide.
2. **PostImage as a child table** — avoids storing image URLs as a PostgreSQL array; easier to add/remove/reorder individual images.
3. **Booking → Slot (not Post)** — ties each booking to a specific date. PostID can always be derived via `Slot.post_id`.
4. **guide_id in Booking** — redundant with `Slot → Post → user_id` but kept for performance (guide dashboard queries need it constantly).
5. **Max 5 posts per user** — enforced in Python (count query before insert), not a DB constraint.
6. **Slot.available** — manual guide toggle; capacity check (booking count vs max_group_size) is a separate app-layer concern.
