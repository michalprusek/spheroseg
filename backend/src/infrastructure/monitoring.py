from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.resources import Resource
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter

class Monitoring:
    def __init__(self, app_name: str):
        self.resource = Resource.create({"service.name": app_name})
        
        # Trace provider
        trace_provider = TracerProvider(resource=self.resource)
        trace.set_tracer_provider(trace_provider)
        
        # Metrics provider
        self.meter_provider = MeterProvider(resource=self.resource)
        metrics.set_meter_provider(self.meter_provider)
        
        self.meter = self.meter_provider.get_meter("spheroseg.metrics")
        
        # Metriky
        self.image_processing_duration = self.meter.create_histogram(
            name="image_processing_duration",
            description="Doba zpracování obrázku",
            unit="ms"
        )
        
        self.active_users = self.meter.create_up_down_counter(
            name="active_users",
            description="Počet aktivních uživatelů"
        )
        
        self.project_count = self.meter.create_up_down_counter(
            name="project_count",
            description="Celkový počet projektů"
        )
        
        self.processing_errors = self.meter.create_counter(
            name="processing_errors",
            description="Počet chyb při zpracování"
        )

    def instrument_app(self, app, db):
        FastAPIInstrumentor.instrument_app(app)
        SQLAlchemyInstrumentor().instrument(engine=db.engine)

    def record_processing_duration(self, duration_ms: float, labels: Dict[str, str]):
        self.image_processing_duration.record(duration_ms, labels)

    def increment_active_users(self):
        self.active_users.add(1)

    def decrement_active_users(self):
        self.active_users.add(-1)

    def record_error(self, error_type: str):
        self.processing_errors.add(1, {"error_type": error_type})

monitoring = Monitoring("spheroseg-backend")