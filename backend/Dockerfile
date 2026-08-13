FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
# Privacy-first: use our log config so uvicorn never writes visitor IPs to logs.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--log-config", "log_config.ini"]
