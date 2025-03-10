from prometheus_client import Counter, Histogram, Info
from prometheus_client.openmetrics.exposition import generate_latest
from fastapi import APIRouter, Response

router = APIRouter()

# Metriky
http_requests_total = Counter(
    'http_requests_total',
    'Total number of HTTP requests',
    ['method', 'endpoint', 'status']
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint']
)

app_info = Info('app_info', 'Application information')
app_info.info({
    'version': '0.1.0',
    'name': 'spheroseg-backend'
})

@router.get("/metrics")
async def metrics():
    return Response(
        generate_latest(),
        media_type="text/plain"
    )