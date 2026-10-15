FROM node:24-bookworm-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim-bookworm
LABEL org.opencontainers.image.source="https://github.com/chinmaykrishnroy/DeChord" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.licenses="MIT"
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    DECHORD_DATA_DIR=/data NUMBA_CACHE_DIR=/data/numba OMP_NUM_THREADS=2
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libsndfile1 libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 dechord && useradd --uid 10001 --gid dechord --create-home dechord \
    && mkdir /data && chown dechord:dechord /data
WORKDIR /app
COPY backend/requirements-backend.txt backend/requirements-analysis.txt ./backend/
RUN python -m pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.14.1 \
    && python -m pip install --no-cache-dir -r backend/requirements-backend.txt lv-chordia==1.1.0
COPY backend/ ./backend/
COPY legacy_desktop/ ./legacy_desktop/
COPY --from=frontend /build/frontend/dist ./frontend/dist
USER dechord
VOLUME ["/data"]
EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/health', timeout=4)"
CMD ["python", "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8765", "--workers", "1", "--no-access-log"]
