from prometheus_client import Counter, Histogram, Gauge
import time
from typing import Callable, Any
from functools import wraps
from ..config import settings

class MetricsCollector:
    def __init__(self):
        # Counters
        self.request_count = Counter(
            'http_requests_total',
            'Total HTTP requests',
            ['method', 'endpoint', 'status']
        )
        
        self.error_count = Counter(
            'error_total',
            'Total errors',
            ['type', 'location']
        )
        
        # Histograms
        self.request_latency = Histogram(
            'request_latency_seconds',
            'Request latency in seconds',
            ['method', 'endpoint']
        )
        
        self.processing_time = Histogram(
            'image_processing_seconds',
            'Image processing time in seconds',
            ['operation']
        )
        
        # Gauges
        self.active_users = Gauge(
            'active_users',
            'Number of active users'
        )
        
        self.queue_size = Gauge(
            'task_queue_size',
            'Number of tasks in queue',
            ['queue_name']
        )

    def track_request(self) -> Callable:
        """Dekorátor pro sledování HTTP požadavků"""
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            async def wrapper(*args, **kwargs) -> Any:
                method = kwargs.get('method', 'UNKNOWN')
                endpoint = kwargs.get('endpoint', 'UNKNOWN')
                
                start_time = time.time()
                
                try:
                    result = await func(*args, **kwargs)
                    status = result.status_code
                except Exception as e:
                    status = 500
                    self.error_count.labels(
                        type=type(e).__name__,
                        location=func.__name__
                    ).inc()
                    raise
                finally:
                    self.request_count.labels(
                        method=method,
                        endpoint=endpoint,
                        status=status
                    ).inc()
                    
                    self.request_latency.labels(
                        method=method,
                        endpoint=endpoint
                    ).observe(time.time() - start_time)
                
                return result
            return wrapper
        return decorator

    def track_processing(self, operation: str) -> Callable:
        """Dekorátor pro sledování zpracování obrázků"""
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            async def wrapper(*args, **kwargs) -> Any:
                start_time = time.time()
                
                try:
                    result = await func(*args, **kwargs)
                except Exception as e:
                    self.error_count.labels(
                        type=type(e).__name__,
                        location=f"{operation}:{func.__name__}"
                    ).inc()
                    raise
                finally:
                    self.processing_time.labels(
                        operation=operation
                    ).observe(time.time() - start_time)
                
                return result
            return wrapper
        return decorator

    def update_queue_size(self, queue_name: str, size: int):
        """Aktualizuje velikost fronty"""
        self.queue_size.labels(queue_name=queue_name).set(size)

    def update_active_users(self, count: int):
        """Aktualizuje počet aktivních uživatelů"""
        self.active_users.set(count)