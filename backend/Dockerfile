# Production image for the Seat Booking FastAPI backend.
# Build context must be the backend/ directory (see docker-compose.yml).
FROM python:3.12-slim

WORKDIR /app

# Build tools needed to compile a couple of native deps (e.g. cryptography,
# cffi) that don't always ship a manylinux wheel for every platform; removed
# after install to keep the final image lean.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .
COPY scripts ./scripts
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Runs as a non-root user in the container.
RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
