# Build from the REPO ROOT (the image needs data/seed):
#   docker build -f mock-erp/Dockerfile -t supplyguard-mock-erp .
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    MOCK_ERP_DATA_DIR=/srv/data/seed
WORKDIR /srv/mock-erp
COPY mock-erp/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY data/seed /srv/data/seed
COPY mock-erp/app ./app
RUN useradd --no-create-home --uid 10001 erp
USER erp
EXPOSE 8081
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8081/health').status==200 else 1)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8081"]
