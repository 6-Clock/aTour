# Deploy image for the backend. NOTE: local dev does NOT use this — per the
# project setup, docker-compose runs Postgres only and the API runs on the host
# (uvicorn). This Dockerfile is the containerized-deploy artifact: the entrypoint
# applies migrations before serving, so a fresh environment comes up schema-ready.
FROM python:3.13-slim

WORKDIR /app

# Install deps first so the layer caches across code changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code + migration assets.
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .
COPY scripts ./scripts

EXPOSE 8000

# Migrate, then serve. DATABASE_URL / SECRET_KEY / GEMINI_API_KEY come from the
# environment (never baked into the image).
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
