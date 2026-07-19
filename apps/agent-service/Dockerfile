FROM python:3.12-slim

WORKDIR /app

COPY packages/agent-sdk/requirements.txt ./packages/agent-sdk/
RUN pip install --no-cache-dir -r ./packages/agent-sdk/requirements.txt

COPY apps/agent-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY packages/agent-sdk ./packages/agent-sdk
RUN pip install -e ./packages/agent-sdk
COPY apps/agent-service ./apps/agent-service

EXPOSE 8001

CMD ["python", "apps/agent-service/main.py"]