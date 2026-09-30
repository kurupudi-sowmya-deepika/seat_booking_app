# Production image for the SpaceHub MCP server.
# Build context must be the REPO ROOT (not mcp_server/), since this package
# imports as `mcp_server.*` - see docker-compose.yml.
FROM python:3.12-slim

WORKDIR /app

COPY mcp_server/requirements.txt ./mcp_server/requirements.txt
RUN pip install --no-cache-dir -r mcp_server/requirements.txt

COPY mcp_server ./mcp_server

RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser

# Only meaningful for MCP_TRANSPORT=streamable-http - ignored for stdio.
EXPOSE 8100

# Defaults to a networked, production-friendly transport in the container;
# override to "stdio" only if you intend to exec into the container and
# attach a local client directly (unusual - stdio is normally for a client
# spawning this process itself, not a running container).
ENV MCP_TRANSPORT=streamable-http \
    MCP_HOST=0.0.0.0 \
    MCP_PORT=8100

CMD ["python", "-m", "mcp_server.server"]
