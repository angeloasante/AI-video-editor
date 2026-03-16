# Kluxta Backend — Combined Node.js + Python for Google Cloud Run
# Single container running both services with a process manager

FROM node:20-slim AS node-build

WORKDIR /app/backend

# Install Node.js dependencies and build
COPY layerai-backend/package*.json ./
RUN npm ci

COPY layerai-backend/tsconfig.json ./
COPY layerai-backend/src ./src
RUN npm run build
RUN npm prune --production

# -------------------------------------------
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies: FFmpeg, Node.js, fonts, supervisord
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    wget \
    unzip \
    fontconfig \
    supervisor \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Download Inter font for FFmpeg text rendering
RUN mkdir -p /app/fonts && \
    wget -q "https://github.com/rsms/inter/releases/download/v4.0/Inter-4.0.zip" -O /tmp/inter.zip && \
    unzip -q /tmp/inter.zip -d /tmp/inter && \
    find /tmp/inter -name "*.ttf" -exec cp {} /app/fonts/ \; && \
    rm -rf /tmp/inter /tmp/inter.zip && \
    fc-cache -fv

# --- Python FFmpeg service ---
WORKDIR /app/python
COPY layerai-backend/python/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY layerai-backend/python/ .

# --- Node.js API service ---
WORKDIR /app/backend
COPY --from=node-build /app/backend/node_modules ./node_modules
COPY --from=node-build /app/backend/dist ./dist
COPY layerai-backend/package.json ./

# --- Supervisor config to run both services ---
COPY <<'EOF' /etc/supervisor/conf.d/kluxta.conf
[supervisord]
nodaemon=true
logfile=/dev/null
logfile_maxbytes=0

[program:node-api]
command=node /app/backend/dist/index.js
directory=/app/backend
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
environment=PYTHON_API_URL="http://localhost:8001"

[program:python-ffmpeg]
command=uvicorn main:app --host 0.0.0.0 --port 8001
directory=/app/python
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
environment=PORT="8001"
EOF

WORKDIR /app

# Cloud Run uses PORT env var (defaults to 8080, mapped to Node.js)
ENV PORT=3001
EXPOSE 3001

# Health check against the Node.js API
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3001}/api/health || exit 1

CMD ["supervisord", "-c", "/etc/supervisor/conf.d/kluxta.conf"]
