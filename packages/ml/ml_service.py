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
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'model_path': MODEL_PATH,
        'model_exists': os.path.exists(MODEL_PATH)
    })

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

        # Run segmentation using subprocess
        import subprocess

        try:
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
            start_time = time.time()
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
                response = requests.put(callback_url, json=result_data)
                response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
                logger.info(f"Successfully sent result for {image_id} to backend.")
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