# aTour Setup Guide

aTour is an AI-powered tour marketplace where local guides list experiences (street food walks, hikes, market tours) and tourists find the right one using plain-language search backed by Google Gemini. Guides manage availability and bookings; tourists browse, book, and leave reviews.

---

## Prerequisites

Install these before anything else:

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.11+ | Backend runtime |
| Node.js + npm | 18+ | Frontend toolchain |
| Expo CLI | latest | `npm install -g expo-cli` |
| Docker + Docker Compose | latest | Local orchestration |
| PostgreSQL | 15+ | Can run via Docker instead |
| AWS CLI | v2 | For S3 and SES configuration |

---

## Environment Variables

Create a `.env` file at the project root (git-ignored — never commit it):

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/atour

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key_here

# AWS
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=atour-media

# Email
SES_SENDER_EMAIL=noreply@yourdomain.com

# Auth
JWT_SECRET=your_long_random_secret_here
```

---

## Backend Setup

### Why a virtual environment?

Python installs packages globally by default, which means if two projects on your machine need different versions of the same library, they conflict. A virtual environment is an isolated folder that contains its own copy of Python and its own packages — completely separate from everything else on your system. When you activate it, `pip install` drops packages there instead of globally. This way aTour's dependencies never collide with other Python projects you work on, and anyone else cloning the repo gets the exact same set of packages.

```bash
cd backend

# Create the virtual environment (creates a folder called "venv")
python -m venv venv

# Activate it — your terminal prompt will change to show (venv) when active
source venv/bin/activate        # macOS/Linux
venv\Scripts\activate           # Windows

# Install all backend dependencies into the virtual environment
pip install -r requirements.txt

# Run database migrations (explained in the Database section below)
alembic upgrade head

# Start the API server
uvicorn main:app --reload --port 8000
```

The `--reload` flag makes the server restart automatically whenever you save a file — useful during development. When you're done working, run `deactivate` to exit the virtual environment.

API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

---

## Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the Expo dev server
expo start
```

Scan the QR code with the Expo Go app (iOS/Android) or press `w` to open in a browser.

---

## Database Setup

PostgreSQL is the database that stores all of aTour's data — guide profiles, listings, bookings, reviews, etc. You have two options for running it: installing it directly on your machine, or letting Docker run it for you (recommended if you've never used PostgreSQL before, since Docker handles all the setup).

### Option A — Run PostgreSQL via Docker (recommended)

If you're using the Docker full-stack setup described below, PostgreSQL starts automatically alongside the backend. You don't need to install PostgreSQL separately. Skip to the **Migrations** step once the containers are running.

### Option B — Install PostgreSQL manually

1. Download and install PostgreSQL from [postgresql.org/download](https://www.postgresql.org/download/)
2. During installation, you'll be asked to set a password for the default `postgres` user — save this, you'll need it
3. After installation, open a terminal and connect to PostgreSQL:

```bash
psql -U postgres
# Enter your password when prompted
```

4. Create the aTour database:

```sql
CREATE DATABASE atour;
\q
```

5. Update your `.env` file so `DATABASE_URL` matches your credentials:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/atour
```

### Migrations

Migrations are versioned scripts that create and update the database tables. Instead of manually writing SQL to create every table, Alembic (the migration tool) tracks what the database should look like and applies changes in order. Think of it like a version-control system for your database schema.

Once PostgreSQL is running and your `DATABASE_URL` is set, run from the `backend/` directory:

```bash
alembic upgrade head
```

`head` means "apply all migrations up to the latest version." This creates all seven tables. If you later add a new table or column, a new migration file is generated and `alembic upgrade head` applies just that change.

### Schema overview

| Table | Description |
|-------|-------------|
| `guides` | Guide profiles — bio, photo, languages, city |
| `experiences` | Tour listings — title, description, price, duration, category |
| `availability` | Available dates and group size per experience |
| `tourists` | Tourist accounts |
| `bookings` | Confirmed bookings linking tourist ↔ availability slot |
| `reviews` | Star ratings and text reviews per completed booking |
| `categories` | Experience categories (food, outdoor, culture, etc.) |

---

## External Services

### Google Gemini API
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create an API key — free tier gives **1,500 requests/day** on Gemini Flash with no credit card required
3. Add the key to `.env` as `GEMINI_API_KEY`

### AWS S3 (guide photos, listing images)
1. Create an S3 bucket in the AWS console
2. Set bucket name in `.env` as `S3_BUCKET_NAME`
3. Create an IAM user with `s3:PutObject` and `s3:GetObject` permissions and add its keys to `.env`

### AWS SES (booking confirmation emails)
1. Verify your sender email address in the SES console
2. Set it in `.env` as `SES_SENDER_EMAIL`
3. Ensure your IAM user has `ses:SendEmail` permission

---

## Docker (Full Stack)

### What Docker does here

Docker lets you package the backend and database into isolated containers — small, self-contained environments that run the same way on any machine. Instead of installing PostgreSQL directly and manually configuring it to talk to FastAPI, Docker Compose reads a `docker-compose.yml` file and spins up both services together, already wired to each other. This means a teammate can clone the repo, run one command, and have the exact same environment as you.

### Install Docker

Download **Docker Desktop** from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop) and install it. Make sure Docker Desktop is running (you'll see its icon in the system tray) before using any `docker` commands.

### Start the stack

```bash
# From the project root
docker compose up --build
```

- `--build` tells Docker to rebuild the images from scratch. You only strictly need this the first time or after changing dependencies — after that, `docker compose up` is enough.
- Docker will pull the PostgreSQL image automatically on first run (this may take a minute).
- The backend and database start together. Logs from both stream in the same terminal window, prefixed by service name.

### Useful Docker commands

```bash
# Stop all running containers (keeps data intact)
docker compose down

# Stop and wipe the database volume (fresh start)
docker compose down -v

# View running containers
docker ps

# View logs for just the backend
docker compose logs backend

# Restart only one service
docker compose restart backend
```

### Running migrations inside Docker

After the containers are up, run migrations against the Dockerized database:

```bash
docker compose exec backend alembic upgrade head
```

`docker compose exec backend` means "run the following command inside the running backend container."

The frontend (React Native/Expo) is not included in Docker because it runs on your phone or simulator — start it separately with `expo start` from the `frontend/` directory.

---

## Verification

Once everything is running, confirm the stack is healthy:

- [ ] `GET http://localhost:8000/health` returns `200 OK`
- [ ] `http://localhost:8000/docs` loads the Swagger UI
- [ ] Expo app loads on device/simulator without errors
- [ ] Create a guide account and post a test listing
- [ ] Run an AI search: `POST /search` with `{ "query": "outdoor walk under $30" }` and confirm Gemini returns ranked results
- [ ] Make a test booking and verify both guide and tourist receive confirmation emails
