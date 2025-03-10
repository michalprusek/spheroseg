from fastapi import FastAPI
from .infrastructure.monitoring import monitoring
from .infrastructure.database import engine
from .api.v1.api import api_router

app = FastAPI(title="SpheroSeg API")

# Instrumentace aplikace pro monitoring
monitoring.instrument_app(app, engine)

# Registrace routerů
app.include_router(api_router, prefix="/api/v1")

@app.on_event("startup")
async def startup_event():
    # Inicializace monitoringu
    pass

@app.on_event("shutdown")
async def shutdown_event():
    # Cleanup
    pass
