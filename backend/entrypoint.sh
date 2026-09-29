#!/bin/sh
# Applies pending migrations, then starts the production ASGI server. Run as
# the container's ENTRYPOINT so a deploy never forgets the migration step.
set -e

echo "Applying database migrations..."
alembic upgrade head

echo "Starting gunicorn..."
exec gunicorn app.main:app \
    --worker-class uvicorn.workers.UvicornWorker \
    --workers "${GUNICORN_WORKERS:-2}" \
    --bind "0.0.0.0:${PORT:-8000}" \
    --access-logfile - \
    --error-logfile -
