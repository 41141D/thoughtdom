FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY frontend/Dockerfile /app/frontend.Dockerfile

EXPOSE 8000
# Privacy-first: use our log config so uvicorn never writes visitor IPs to logs.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--log-config", "log_config.ini"]
