# Python FFmpeg Service
FROM python:3.11-slim

WORKDIR /app

# Install FFmpeg, fonts, and system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    wget \
    unzip \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

# Create fonts directory and download Inter font
RUN mkdir -p /app/fonts && \
    wget -q "https://github.com/rsms/inter/releases/download/v4.0/Inter-4.0.zip" -O /tmp/inter.zip && \
    unzip -q /tmp/inter.zip -d /tmp/inter && \
    cp /tmp/inter/Inter\ Desktop/*.ttf /app/fonts/ 2>/dev/null || \
    cp /tmp/inter/*.ttf /app/fonts/ 2>/dev/null || \
    find /tmp/inter -name "*.ttf" -exec cp {} /app/fonts/ \; && \
    rm -rf /tmp/inter /tmp/inter.zip

# Rename Inter font files to standardized names (fallback if needed)
RUN cd /app/fonts && \
    [ -f "Inter-Bold.ttf" ] || ln -sf Inter-Regular.ttf Inter-Bold.ttf && \
    [ -f "Inter-Medium.ttf" ] || ln -sf Inter-Regular.ttf Inter-Medium.ttf && \
    [ -f "Inter-Light.ttf" ] || ln -sf Inter-Regular.ttf Inter-Light.ttf && \
    [ -f "Inter-Italic.ttf" ] || ln -sf Inter-Regular.ttf Inter-Italic.ttf

# Update font cache
RUN fc-cache -fv

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose port (Railway sets PORT dynamically)
EXPOSE 8001

# Health check - use PORT env var if set
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8001}/health || exit 1

# Start server - use shell form to expand PORT env var
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}
