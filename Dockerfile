# AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
# Reviewed and directed by the project author.
# Multi-stage build: 1) build the React frontend with Node, 2) run the FastAPI backend with Python.
# Hugging Face Spaces (Docker SDK) expects the app on port 7860 and runs as uid 1000.

FROM node:20-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build


FROM python:3.12-slim AS app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Non-root user with uid 1000, as required by Hugging Face Spaces.
RUN useradd --create-home --uid 1000 user

WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY backend/ ./backend/
COPY --from=frontend /build/frontend/dist ./frontend/dist

# The backend caches fetched data in cache/ (created at runtime); it must be writable by uid 1000.
RUN mkdir -p /app/cache && chown -R user:user /app

USER user
EXPOSE 7860
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
