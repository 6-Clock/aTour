# Database Setup (Local, via Docker)

`backend/database.py` reads its connection string from the `DATABASE_URL` environment variable (via a `.env` file) — it no longer has a hardcoded value, so step 0 below is required before the API will start.

All commands below run directly from your terminal (PowerShell/cmd/bash) — no need to `docker exec` into an interactive bash or `psql` shell.

---

## 0. Create your `.env` file

From `backend/`, copy the example file and keep the default values (they match the Docker container created in step 2):

```bash
cp .env.example .env          # macOS/Linux
copy .env.example .env        # Windows
```

`backend/.env.example` contains:

```
DATABASE_URL=postgresql://myuser:password@localhost:5432/fastapi_db
```

`.env` is git-ignored — never commit it, even though the default values here aren't real secrets.

---

## 1. Pull the Postgres image

```bash
docker pull postgres:alpine
```

## 2. Create and start the container

This single command creates the container **and** auto-creates the `myuser` role, `fastapi_db` database, and sets the password — matching `DATABASE_URL` in `database.py`:

```bash
docker run -d --name atour-postgres -p 5432:5432 -e POSTGRES_USER=myuser -e POSTGRES_PASSWORD=password -e POSTGRES_DB=fastapi_db postgres:alpine
```

## 3. Verify it's running

```bash
docker ps
```

You should see `atour-postgres` listed with port `5432->5432`.

---

## 4. Python environment

From `backend/`:

```bash
python -m venv venv
.\venv\Scripts\activate          # Windows PowerShell
pip install -r requirements.txt
```

## 5. Create the tables

The SQLAlchemy models in `models.py` are registered against `Base.metadata`. From `backend/` (with the venv active and the container running):

```bash
python -c "from services import _add_tables_db; _add_tables_db()"
```

## 6. Run the API

```bash
uvicorn main:app --reload
```

API available at `http://127.0.0.1:8000`, interactive docs at `http://127.0.0.1:8000/docs`.

---

## Inspecting the database from the terminal

No need to enter an interactive `psql` session — pass `-c` with the SQL/meta-command directly:

```bash
# List tables
docker exec -it atour-postgres psql -U myuser -d fastapi_db -c "\dt"

# Describe a table's columns (quote mixed-case names)
docker exec -it atour-postgres psql -U myuser -d fastapi_db -c "\d \"Contact\""

# View all rows in a table
docker exec -it atour-postgres psql -U myuser -d fastapi_db -c "SELECT * FROM \"Contact\";"

# Drop a table (e.g. after changing a model's schema)
docker exec -it atour-postgres psql -U myuser -d fastapi_db -c "DROP TABLE \"Contact\";"
```

If you need a full interactive shell instead of one-off commands:

```bash
docker exec -it atour-postgres psql -U myuser -d fastapi_db
```

---

## Alternative: manual user/database creation

If you instead start a container without `POSTGRES_USER`/`POSTGRES_DB` (e.g. only `POSTGRES_PASSWORD` is set, default `postgres` user/db), create the role and database with one-liners:

```bash
docker run -d --name fastapi-postgres -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:alpine

docker exec -it fastapi-postgres psql -U postgres -c "CREATE DATABASE fastapi_db;"
docker exec -it fastapi-postgres psql -U postgres -c "CREATE USER myuser WITH ENCRYPTED PASSWORD 'password';"
docker exec -it fastapi-postgres psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE fastapi_db TO myuser;"
```

This is more steps for the same result as step 2 above — prefer step 2 unless you have a reason to start from a bare `postgres` superuser container.

---

## Stopping / removing the container

```bash
docker stop atour-postgres
docker rm atour-postgres
```

`docker stop` keeps the container (and its data) around to restart later with `docker start atour-postgres`. `docker rm` deletes it permanently, including its data, since no volume is mounted in this setup.
