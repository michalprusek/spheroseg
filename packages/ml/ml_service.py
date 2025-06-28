from flask import Flask, request, jsonify
import os
import time
import json
import random
import logging
import math
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ml_service")

# Initialize Flask app
app = Flask(__name__)

# Check if model exists
MODEL_PATH = os.environ.get('MODEL_PATH', '/ML/checkpoint_epoch_9.pth.tar')
DEBUG = os.environ.get('DEBUG', 'false').lower() == 'true'

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

@app.route('/segment', methods=['POST'])
def segment():
    """
    Process image segmentation request
    Expected format: JSON with image_path field
    Returns: JSON with segmentation result
    """
    try:
        data = request.json
        if not data or 'image_path' not in data:
            return jsonify({'error': 'Missing image_path in request'}), 400
        
        image_path = data['image_path']
        logger.info(f"Processing segmentation request for image: {image_path}")
        
        # Use actual segmentation via resunet_segmentation.py
        logger.info(f"Starting actual segmentation for: {image_path}")
        
        # Create output directory for this request
        output_dir = os.path.join(UPLOADS_DIR, f"segmentation_{int(time.time() * 1000)}")
        os.makedirs(output_dir, exist_ok=True)
        
        # Run segmentation using subprocess
        import subprocess
        
        try:
            # Prepare command
            cmd = [
                'python', '/ML/resunet_segmentation.py',
                '--image_path', image_path,
                '--output_path', os.path.join(output_dir, 'result.json'),
                '--checkpoint_path', MODEL_PATH
            ]
            
            logger.info(f"Running command: {' '.join(cmd)}")
            
            # Run the segmentation
            start_time = time.time()
            process = subprocess.run(cmd, capture_output=True, text=True)
            processing_time = time.time() - start_time
            
            if process.returncode != 0:
                logger.error(f"Segmentation failed: {process.stderr}")
                return jsonify({
                    'status': 'error',
                    'error': f'Segmentation failed: {process.stderr}',
                    'image_path': image_path
                }), 500
            
            # Read the result
            result_path = os.path.join(output_dir, 'result.json')
            if os.path.exists(result_path):
                with open(result_path, 'r') as f:
                    segmentation_result = json.load(f)
                
                result = {
                    'status': 'success',
                    'image_path': image_path,
                    'processing_time': processing_time,
                    'polygons': segmentation_result.get('polygons', []),
                    'timestamp': datetime.now().isoformat()
                }
                
                return jsonify(result)
            else:
                logger.error(f"Result file not found at: {result_path}")
                return jsonify({
                    'status': 'error',
                    'error': 'Result file not found',
                    'image_path': image_path
                }), 500
                
        except Exception as e:
            logger.error(f"Error during segmentation: {str(e)}")
            return jsonify({
                'status': 'error',
                'error': str(e),
                'image_path': image_path
            }), 500
        
    except Exception as e:
        logger.error(f"Error processing segmentation request: {str(e)}")
        return jsonify({'error': str(e)}), 500

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

if __name__ == '__main__':
    # Check if model exists
    if os.path.exists(MODEL_PATH):
        logger.info(f"ML model found at: {MODEL_PATH}")
    else:
        logger.warning(f"ML model not found at: {MODEL_PATH}")
    
    logger.info("Starting ML service")
    app.run(host='0.0.0.0', port=5002, debug=True)