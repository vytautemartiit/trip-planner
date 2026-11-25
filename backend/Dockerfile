# Backend image for any host that runs containers (Render, Fly.io, Railway, a VPS…)
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY *.py ./

# Keep the SQLite database on a mounted volume so accounts and chats survive restarts
ENV APP_DB=/data/trip_planner.db
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
