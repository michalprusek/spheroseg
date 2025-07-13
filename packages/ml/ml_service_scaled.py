import pika
import requests
from flask import Flask, request, jsonify
import os
import time
import json
import random
import logging
import math
import socket
import signal
import sys
from datetime import datetime
import threading
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
import psutil
from prometheus_client import Counter, Histogram, Gauge, generate_latest

# Configure logging with instance identification
INSTANCE_ID = os.environ.get('HOSTNAME', socket.gethostname())
logging.basicConfig(
    level=logging.INFO,
    format=f'%(asctime)s - {INSTANCE_ID} - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ml_service")

# Initialize Flask app
app = Flask(__name__)

# RabbitMQ Configuration
RABBITMQ_HOST = os.environ.get('RABBITMQ_HOST', 'rabbitmq')
RABBITMQ_PORT = int(os.environ.get('RABBITMQ_PORT', 5672))
RABBITMQ_USER = os.environ.get('RABBITMQ_USER', 'guest')
RABBITMQ_PASS = os.environ.get('RABBITMQ_PASS', 'guest')
RABBITMQ_QUEUE = os.environ.get('RABBITMQ_QUEUE', 'segmentation_tasks')
RABBITMQ_PREFETCH_COUNT = int(os.environ.get('RABBITMQ_PREFETCH_COUNT', 4))
MAX_CONCURRENT_TASKS = int(os.environ.get('MAX_CONCURRENT_TASKS', 4))
HEALTH_CHECK_INTERVAL = int(os.environ.get('HEALTH_CHECK_INTERVAL', 30))

# Check if model exists
MODEL_PATH = os.environ.get('MODEL_PATH', '/ML/checkpoint_epoch_9.pth.tar')
DEBUG = os.environ.get('DEBUG', 'false').lower() == 'true'

# Prometheus metrics
tasks_processed = Counter('ml_tasks_processed_total', 'Total number of tasks processed', ['status', 'instance'])
task_duration = Histogram('ml_task_duration_seconds', 'Task processing duration', ['instance'])
active_tasks = Gauge('ml_active_tasks', 'Number of active tasks', ['instance'])
queue_size = Gauge('ml_queue_size', 'Current queue size', ['instance'])

# Create thread pool for concurrent segmentation processing
executor = ThreadPoolExecutor(
    max_workers=MAX_CONCURRENT_TASKS,
    thread_name_prefix=f"ml-worker-{INSTANCE_ID}"
)

# Create uploads directory if it doesn't exist
UPLOADS_DIR = '/ML/uploads'
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Graceful shutdown handling
shutdown_event = threading.Event()
rabbitmq_connection = None
rabbitmq_channel = None

def signal_handler(sig, frame):
    """Handle shutdown signals gracefully"""
    logger.info(f"Received signal {sig}, initiating graceful shutdown...")
    shutdown_event.set()
    
    # Stop accepting new tasks
    if rabbitmq_channel:
        try:
            rabbitmq_channel.stop_consuming()
        except Exception as e:
            logger.error(f"Error stopping RabbitMQ consumer: {e}")
    
    # Wait for active tasks to complete
    executor.shutdown(wait=True, cancel_futures=False)
    
    # Close RabbitMQ connection
    if rabbitmq_connection and not rabbitmq_connection.is_closed:
        rabbitmq_connection.close()
    
    logger.info("Graceful shutdown complete")
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

@app.route('/health', methods=['GET'])
def health():
    """Enhanced health check endpoint with detailed status"""
    try:
        # Check system resources
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage(UPLOADS_DIR)
        
        # Check model availability
        model_exists = os.path.exists(MODEL_PATH)
        model_size = os.path.getsize(MODEL_PATH) if model_exists else 0
        
        # Check RabbitMQ connection
        rabbitmq_connected = rabbitmq_connection and not rabbitmq_connection.is_closed
        
        # Get active tasks count
        active_count = active_tasks._value.get(INSTANCE_ID, 0)
        
        health_status = {
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'instance_id': INSTANCE_ID,
            'model': {
                'path': MODEL_PATH,
                'exists': model_exists,
                'size_mb': model_size / (1024 * 1024) if model_exists else 0
            },
            'resources': {
                'cpu_percent': cpu_percent,
                'memory_percent': memory.percent,
                'memory_available_mb': memory.available / (1024 * 1024),
                'disk_percent': disk.percent,
                'disk_free_gb': disk.free / (1024 * 1024 * 1024)
            },
            'processing': {
                'active_tasks': active_count,
                'max_concurrent': MAX_CONCURRENT_TASKS,
                'rabbitmq_connected': rabbitmq_connected,
                'prefetch_count': RABBITMQ_PREFETCH_COUNT
            }
        }
        
        # Determine if unhealthy
        if not model_exists:
            health_status['status'] = 'unhealthy'
            health_status['reason'] = 'Model file not found'
        elif memory.percent > 90:
            health_status['status'] = 'degraded'
            health_status['reason'] = 'High memory usage'
        elif cpu_percent > 90:
            health_status['status'] = 'degraded'
            health_status['reason'] = 'High CPU usage'
        elif not rabbitmq_connected:
            health_status['status'] = 'degraded'
            health_status['reason'] = 'RabbitMQ disconnected'
        
        status_code = 200 if health_status['status'] == 'healthy' else 503
        return jsonify(health_status), status_code
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.now().isoformat(),
            'instance_id': INSTANCE_ID
        }), 503

@app.route('/metrics', methods=['GET'])
def metrics():
    """Prometheus metrics endpoint"""
    return generate_latest()

def process_segmentation(task):
    """Process a single segmentation task"""
    task_id = task.get('taskId')
    image_id = task.get('imageId')
    image_path = task.get('imagePath')
    parameters = task.get('parameters', {})
    callback_url = task.get('callbackUrl')
    
    start_time = time.time()
    active_tasks.labels(instance=INSTANCE_ID).inc()
    
    try:
        logger.info(f"Processing segmentation for image: {image_path} (Task ID: {task_id})")
        
        # Create output directory for this request
        output_dir = os.path.join(UPLOADS_DIR, f"segmentation_{task_id}")
        os.makedirs(output_dir, exist_ok=True)
        
        # Make sure image_path is absolute
        if not image_path.startswith('/'):
            image_path = os.path.join(UPLOADS_DIR, image_path)
        
        cmd = [
            'python', '/ML/resunet_segmentation.py',
            '--image_path', image_path,
            '--output_path', os.path.join(output_dir, 'result.json'),
            '--checkpoint_path', MODEL_PATH,
            '--output_dir', output_dir
        ]
        
        logger.info(f"Running command: {' '.join(cmd)}")
        
        # Run the segmentation with timeout
        process = subprocess.run(
            cmd, 
            capture_output=True, 
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        processing_time = time.time() - start_time
        
        if process.returncode != 0:
            raise Exception(f"Segmentation failed: {process.stderr}")
        
        # Read the result
        result_path = os.path.join(output_dir, 'result.json')
        if not os.path.exists(result_path):
            raise Exception("Result file not found")
        
        with open(result_path, 'r') as f:
            segmentation_result = json.load(f)
        
        result_data = {
            'status': 'completed',
            'result_data': {
                'polygons': segmentation_result.get('polygons', []),
                'processing_time': processing_time,
                'timestamp': datetime.now().isoformat(),
                'processed_by': INSTANCE_ID
            },
            'parameters': parameters
        }
        
        # Send result to callback URL
        logger.info(f"Segmentation completed for {image_id}. Sending result to {callback_url}")
        response = requests.put(
            callback_url, 
            json=result_data,
            timeout=30
        )
        response.raise_for_status()
        
        # Update metrics
        tasks_processed.labels(status='success', instance=INSTANCE_ID).inc()
        task_duration.labels(instance=INSTANCE_ID).observe(processing_time)
        
        logger.info(f"Successfully processed task {task_id} in {processing_time:.2f}s")
        return True
        
    except subprocess.TimeoutExpired:
        logger.error(f"Segmentation timeout for task {task_id}")
        error_data = {
            'status': 'failed',
            'error': 'Processing timeout exceeded',
            'parameters': parameters,
            'processed_by': INSTANCE_ID
        }
        tasks_processed.labels(status='timeout', instance=INSTANCE_ID).inc()
        
    except Exception as e:
        logger.error(f"Error during segmentation for task {task_id}: {str(e)}")
        error_data = {
            'status': 'failed',
            'error': str(e),
            'parameters': parameters,
            'processed_by': INSTANCE_ID
        }
        tasks_processed.labels(status='error', instance=INSTANCE_ID).inc()
    
    finally:
        active_tasks.labels(instance=INSTANCE_ID).dec()
        
        # Cleanup output directory
        try:
            if 'output_dir' in locals() and os.path.exists(output_dir):
                import shutil
                shutil.rmtree(output_dir)
        except Exception as e:
            logger.warning(f"Failed to cleanup output directory: {e}")
    
    # Send error callback
    try:
        logger.info(f"Sending error callback for {image_id} to {callback_url}")
        response = requests.put(
            callback_url, 
            json=error_data,
            timeout=30
        )
        response.raise_for_status()
    except Exception as callback_e:
        logger.error(f"Failed to send error callback for {image_id}: {str(callback_e)}")
    
    return False

def process_message(ch, method, properties, body):
    """Callback function to process messages from RabbitMQ"""
    if shutdown_event.is_set():
        # Reject message during shutdown
        ch.basic_nack(method.delivery_tag, requeue=True)
        return
    
    try:
        task = json.loads(body)
        logger.info(f"Received task: {task.get('taskId')}")
        
        task_id = task.get('taskId')
        image_id = task.get('imageId')
        image_path = task.get('imagePath')
        callback_url = task.get('callbackUrl')
        
        if not all([task_id, image_id, image_path, callback_url]):
            logger.error(f"Invalid task received: {task}")
            ch.basic_nack(method.delivery_tag, requeue=False)
            return
        
        # Submit task to thread pool
        future = executor.submit(process_segmentation, task)
        
        # Wait for completion
        try:
            success = future.result(timeout=330)  # 5.5 minute timeout
            if success:
                ch.basic_ack(method.delivery_tag)
            else:
                ch.basic_nack(method.delivery_tag, requeue=False)
        except Exception as e:
            logger.error(f"Task execution failed: {e}")
            ch.basic_nack(method.delivery_tag, requeue=False)
            
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in message: {e}")
        ch.basic_nack(method.delivery_tag, requeue=False)
    except Exception as e:
        logger.error(f"Error processing RabbitMQ message: {str(e)}")
        ch.basic_nack(method.delivery_tag, requeue=False)

def start_rabbitmq_consumer():
    """Connects to RabbitMQ and starts consuming messages"""
    global rabbitmq_connection, rabbitmq_channel
    
    while not shutdown_event.is_set():
        try:
            # Create connection with heartbeat
            connection_params = pika.ConnectionParameters(
                host=RABBITMQ_HOST,
                port=RABBITMQ_PORT,
                credentials=pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS),
                heartbeat=600,  # 10 minute heartbeat
                blocked_connection_timeout=300,
                connection_attempts=3,
                retry_delay=2
            )
            
            rabbitmq_connection = pika.BlockingConnection(connection_params)
            rabbitmq_channel = rabbitmq_connection.channel()
            
            # Declare queue
            rabbitmq_channel.queue_declare(queue=RABBITMQ_QUEUE, durable=True)
            
            # Set QoS
            rabbitmq_channel.basic_qos(prefetch_count=RABBITMQ_PREFETCH_COUNT)
            
            # Start consuming
            rabbitmq_channel.basic_consume(
                queue=RABBITMQ_QUEUE, 
                on_message_callback=process_message
            )
            
            logger.info(
                f"Started RabbitMQ consumer for queue: {RABBITMQ_QUEUE} "
                f"with prefetch_count: {RABBITMQ_PREFETCH_COUNT}"
            )
            
            # Update queue size metric periodically
            def update_queue_metrics():
                while not shutdown_event.is_set() and not rabbitmq_connection.is_closed:
                    try:
                        method = rabbitmq_channel.queue_declare(
                            queue=RABBITMQ_QUEUE, 
                            passive=True
                        )
                        queue_size.labels(instance=INSTANCE_ID).set(
                            method.method.message_count
                        )
                    except Exception as e:
                        logger.error(f"Failed to update queue metrics: {e}")
                    time.sleep(10)
            
            metrics_thread = threading.Thread(target=update_queue_metrics)
            metrics_thread.daemon = True
            metrics_thread.start()
            
            # Start consuming
            rabbitmq_channel.start_consuming()
            
        except pika.exceptions.AMQPConnectionError as e:
            logger.error(f"RabbitMQ connection error: {e}. Retrying in 5 seconds...")
            time.sleep(5)
        except Exception as e:
            logger.error(f"Unexpected error in RabbitMQ consumer: {e}. Retrying in 5 seconds...")
            time.sleep(5)
        finally:
            # Cleanup connection
            if rabbitmq_connection and not rabbitmq_connection.is_closed:
                try:
                    rabbitmq_connection.close()
                except Exception:
                    pass

if __name__ == '__main__':
    # Log startup information
    logger.info(f"Starting ML service instance: {INSTANCE_ID}")
    logger.info(f"Configuration: MAX_CONCURRENT_TASKS={MAX_CONCURRENT_TASKS}, "
                f"PREFETCH_COUNT={RABBITMQ_PREFETCH_COUNT}")
    
    # Check if model exists
    if os.path.exists(MODEL_PATH):
        logger.info(f"ML model found at: {MODEL_PATH}")
        model_size = os.path.getsize(MODEL_PATH) / (1024 * 1024)
        logger.info(f"Model size: {model_size:.2f} MB")
    else:
        logger.error(f"ML model not found at: {MODEL_PATH}")
        logger.warning("Service will run but segmentation will fail")
    
    # Start RabbitMQ consumer in a separate thread
    consumer_thread = threading.Thread(target=start_rabbitmq_consumer)
    consumer_thread.daemon = True
    consumer_thread.start()
    
    # Start Flask app
    logger.info("Starting ML service Flask app")
    app.run(host='0.0.0.0', port=5002, debug=DEBUG, threaded=True)