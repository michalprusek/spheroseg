import pika
import requests
from flask import Flask, request, jsonify
import os
import time
import json
import random
import logging
import math
from datetime import datetime
import threading
import subprocess
from concurrent.futures import ThreadPoolExecutor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
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

# Check if model exists
MODEL_PATH = os.environ.get('MODEL_PATH', '/ML/checkpoint_epoch_9.pth.tar')
DEBUG = os.environ.get('DEBUG', 'false').lower() == 'true'

# Create thread pool for concurrent segmentation processing
executor = ThreadPoolExecutor(max_workers=RABBITMQ_PREFETCH_COUNT)

# Create uploads directory if it doesn't exist
UPLOADS_DIR = '/ML/uploads'
os.makedirs(UPLOADS_DIR, exist_ok=True)

@app.route('/health', methods=['GET'])
def health():
    """Comprehensive health check endpoint"""
    health_status = check_health_status()
    status_code = 200 if health_status['status'] == 'healthy' else 503
    return jsonify(health_status), status_code

@app.route('/health/live', methods=['GET'])
def liveness():
    """Kubernetes liveness probe - checks if service is alive"""
    return jsonify({
        'status': 'alive',
        'timestamp': datetime.now().isoformat(),
        'pid': os.getpid()
    })

@app.route('/health/ready', methods=['GET'])
def readiness():
    """Kubernetes readiness probe - checks if service is ready to accept requests"""
    # Check if model is loaded and RabbitMQ is connected
    is_ready = os.path.exists(MODEL_PATH) and check_rabbitmq_connection()
    
    if is_ready:
        return jsonify({
            'status': 'ready',
            'timestamp': datetime.now().isoformat()
        })
    else:
        return jsonify({
            'status': 'not_ready',
            'timestamp': datetime.now().isoformat(),
            'reason': 'Model not loaded or RabbitMQ not connected'
        }), 503

def check_health_status():
    """Perform comprehensive health checks"""
    components = {}
    issues = []
    
    # Check model availability
    model_exists = os.path.exists(MODEL_PATH)
    components['model'] = {
        'status': 'healthy' if model_exists else 'unhealthy',
        'path': MODEL_PATH,
        'exists': model_exists
    }
    if not model_exists:
        issues.append('Model file not found')
    
    # Check RabbitMQ connection
    rabbitmq_connected = check_rabbitmq_connection()
    components['rabbitmq'] = {
        'status': 'healthy' if rabbitmq_connected else 'degraded',
        'host': RABBITMQ_HOST,
        'port': RABBITMQ_PORT,
        'queue': RABBITMQ_QUEUE
    }
    if not rabbitmq_connected:
        issues.append('RabbitMQ connection failed')
    
    # Check system resources
    memory_info = get_memory_info()
    components['memory'] = {
        'status': 'healthy' if memory_info['percentage'] < 90 else 'degraded',
        'used_mb': memory_info['used_mb'],
        'total_mb': memory_info['total_mb'],
        'percentage': memory_info['percentage']
    }
    if memory_info['percentage'] > 90:
        issues.append('High memory usage')
    
    # Check disk space
    disk_info = get_disk_info()
    components['disk'] = {
        'status': 'healthy' if disk_info['percentage'] < 90 else 'degraded',
        'free_gb': disk_info['free_gb'],
        'percentage': disk_info['percentage']
    }
    if disk_info['percentage'] > 90:
        issues.append('Low disk space')
    
    # Determine overall status
    overall_status = 'healthy'
    if any(c['status'] == 'unhealthy' for c in components.values()):
        overall_status = 'unhealthy'
    elif any(c['status'] == 'degraded' for c in components.values()):
        overall_status = 'degraded'
    
    return {
        'status': overall_status,
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0',
        'uptime': time.time() - app.config.get('start_time', time.time()),
        'components': components,
        'issues': issues,
        'environment': {
            'debug': DEBUG,
            'prefetch_count': RABBITMQ_PREFETCH_COUNT
        }
    }

def check_rabbitmq_connection():
    """Check if RabbitMQ is accessible"""
    try:
        credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
        parameters = pika.ConnectionParameters(
            host=RABBITMQ_HOST,
            port=RABBITMQ_PORT,
            credentials=credentials,
            connection_attempts=1,
            retry_delay=0
        )
        connection = pika.BlockingConnection(parameters)
        connection.close()
        return True
    except Exception as e:
        logger.warning(f"RabbitMQ connection check failed: {e}")
        return False

def get_memory_info():
    """Get memory usage information"""
    try:
        import psutil
        memory = psutil.virtual_memory()
        return {
            'used_mb': round(memory.used / 1024 / 1024, 2),
            'total_mb': round(memory.total / 1024 / 1024, 2),
            'percentage': memory.percent
        }
    except:
        # Fallback if psutil not available
        return {
            'used_mb': 0,
            'total_mb': 0,
            'percentage': 0
        }

def get_disk_info():
    """Get disk usage information for ML directory"""
    try:
        import shutil
        stat = shutil.disk_usage('/ML')
        return {
            'free_gb': round(stat.free / 1024 / 1024 / 1024, 2),
            'percentage': round((stat.used / stat.total) * 100, 2)
        }
    except:
        return {
            'free_gb': 0,
            'percentage': 0
        }

# Removed /segment endpoint - it will be replaced by RabbitMQ consumer

def generate_mock_polygons():
    """Generate mock polygon data for development"""
    num_polygons = random.randint(3, 8)
    polygons = []
    
    for i in range(num_polygons):
        # Generate a polygon with 5-10 points
        num_points = random.randint(5, 10)
        points = []
        
        # Random center for the polygon
        center_x = random.randint(100, 900)
        center_y = random.randint(100, 900)
        
        # Generate points around the center
        for j in range(num_points):
            angle = (j / num_points) * 2 * 3.14159
            distance = random.randint(30, 100)
            x = center_x + int(distance * math.cos(angle))
            y = center_y + int(distance * math.sin(angle))
            points.append([x, y])
        
        polygons.append({
            'id': i + 1,
            'points': points,
            'class': random.choice(['cell', 'nucleus', 'debris']),
            'confidence': random.uniform(0.75, 0.98)
        })
    
    return polygons

def process_message(ch, method, properties, body):
    """Callback function to process messages from RabbitMQ"""
    try:
        task = json.loads(body)
        logger.info(f"Received task: {task}")

        task_id = task.get('taskId')
        image_id = task.get('imageId')
        image_path = task.get('imagePath')
        parameters = task.get('parameters', {})
        callback_url = task.get('callbackUrl')

        if not all([task_id, image_id, image_path, callback_url]):
            logger.error(f"Invalid task received: {task}")
            ch.basic_nack(method.delivery_tag, requeue=False)
            return

        logger.info(f"Processing segmentation for image: {image_path} (Task ID: {task_id})")

        # Create output directory for this request
        output_dir = os.path.join(UPLOADS_DIR, f"segmentation_{task_id}")
        os.makedirs(output_dir, exist_ok=True)

        try:
            start_time = time.time()
            
            # Handle DEBUG mode with mock polygons
            # Check DEBUG at runtime to allow for environment variable patching in tests
            debug_mode = os.environ.get('DEBUG', 'false').lower() == 'true'
            if debug_mode:
                logger.info("DEBUG mode: Using mock polygons")
                # Generate mock polygons for development
                mock_polygons = generate_mock_polygons()
                processing_time = time.time() - start_time
                
                result_data = {
                    'taskId': task_id,
                    'imageId': image_id,
                    'status': 'completed',
                    'polygons': mock_polygons,
                    'processing_time': processing_time,
                    'timestamp': datetime.now().isoformat()
                }
                logger.info(f"Mock segmentation completed for {image_id}. Sending result to {callback_url}")
                response = requests.post(callback_url, data=json.dumps(result_data), headers={'Content-Type': 'application/json'})
                response.raise_for_status()
                logger.info(f"Successfully sent mock result for {image_id} to backend.")
                ch.basic_ack(method.delivery_tag)
            else:
                # Production mode: Run actual segmentation using subprocess
                import subprocess
                
                # Prepare command
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

                # Run the segmentation
                process = subprocess.run(cmd, capture_output=True, text=True)
                processing_time = time.time() - start_time

                if process.returncode != 0:
                    logger.error(f"Segmentation failed: {process.stderr}")
                    raise Exception(f"Segmentation failed: {process.stderr}")

                # Read the result
                result_path = os.path.join(output_dir, 'result.json')
                if os.path.exists(result_path):
                    with open(result_path, 'r') as f:
                        segmentation_result = json.load(f)

                    result_data = {
                        'status': 'completed',
                        'result_data': {
                            'polygons': segmentation_result.get('polygons', []),
                            'processing_time': processing_time,
                            'timestamp': datetime.now().isoformat()
                        },
                        'parameters': parameters
                    }
                    logger.info(f"Segmentation completed for {image_id}. Sending result to {callback_url}")
                    try:
                        response = requests.put(callback_url, json=result_data)
                        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
                        logger.info(f"Successfully sent result for {image_id} to backend.")
                    except Exception as callback_e:
                        logger.error(f"Failed to send success callback for {image_id}: {str(callback_e)}")
                        # Still ack the message since segmentation succeeded
                    ch.basic_ack(method.delivery_tag)
                else:
                    logger.error(f"Result file not found at: {result_path}")
                    raise Exception("Result file not found")

        except Exception as e:
            logger.error(f"Error during segmentation for task {task_id}: {str(e)}")
            error_data = {
                'status': 'failed',
                'error': str(e),
                'parameters': parameters
            }
            logger.info(f"Segmentation failed for {image_id}. Sending error to {callback_url}")
            try:
                response = requests.put(callback_url, json=error_data)
                response.raise_for_status()
                logger.info(f"Successfully sent error for {image_id} to backend.")
            except Exception as callback_e:
                logger.error(f"Failed to send error callback for {image_id}: {str(callback_e)}")
            ch.basic_nack(method.delivery_tag, requeue=False) # Nack the message, do not requeue

    except Exception as e:
        logger.error(f"Error processing RabbitMQ message: {str(e)}")
        ch.basic_nack(method.delivery_tag, requeue=False)

def start_rabbitmq_consumer():
    """Connects to RabbitMQ and starts consuming messages"""
    while True:
        try:
            connection = pika.BlockingConnection(pika.ConnectionParameters(
                host=RABBITMQ_HOST,
                port=RABBITMQ_PORT,
                credentials=pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
            ))
            channel = connection.channel()
            channel.queue_declare(queue=RABBITMQ_QUEUE, durable=True)
            # Increase prefetch count to allow concurrent processing
            # This allows multiple images to be processed simultaneously
            channel.basic_qos(prefetch_count=RABBITMQ_PREFETCH_COUNT)
            channel.basic_consume(queue=RABBITMQ_QUEUE, on_message_callback=process_message)

            logger.info(f"Started RabbitMQ consumer for queue: {RABBITMQ_QUEUE} with prefetch_count: {RABBITMQ_PREFETCH_COUNT}")
            channel.start_consuming()
        except pika.exceptions.AMQPConnectionError as e:
            logger.error(f"RabbitMQ connection error: {e}. Retrying in 5 seconds...")
            time.sleep(5)
        except Exception as e:
            logger.error(f"An unexpected error occurred in RabbitMQ consumer: {e}. Retrying in 5 seconds...")
            time.sleep(5)

if __name__ == '__main__':
    # Track startup time
    app.config['start_time'] = time.time()
    
    # Start RabbitMQ consumer in a separate thread
    consumer_thread = threading.Thread(target=start_rabbitmq_consumer)
    consumer_thread.daemon = True
    consumer_thread.start()

    # Check if model exists
    if os.path.exists(MODEL_PATH):
        logger.info(f"ML model found at: {MODEL_PATH}")
    else:
        logger.warning(f"ML model not found at: {MODEL_PATH}")
    
    logger.info("Starting ML service Flask app")
    app.run(host='0.0.0.0', port=5002, debug=DEBUG)