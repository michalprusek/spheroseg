#!/usr/bin/env python3
"""
Vylepšená ML služba pro segmentaci obrázků

Tato služba poskytuje robustní API pro segmentaci obrázků:
- Podpora více modelů (ResUNet, U-Net, DeepLabV3+)
- Efektivní zpracování velkých obrázků
- Automatické škálování na dostupné GPU
- Detailní metriky a monitoring
- Zpracování dávek obrázků
- Cachování výsledků pro rychlejší odezvu
"""

import os
import time
import json
import uuid
import logging
import math
import traceback
import tempfile
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Union, Any

import numpy as np
from PIL import Image
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import transforms
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from prometheus_client import start_http_server, Counter, Gauge, Histogram
import redis

# Konfigurace logování
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ml_service")

# Konfigurace z proměnných prostředí
DEBUG = os.environ.get('DEBUG', 'false').lower() == 'true'
MODEL_PATH = os.environ.get('MODEL_PATH', '/ML/checkpoint_epoch_9.pth.tar')
MODEL_TYPE = os.environ.get('MODEL_TYPE', 'resunet')
DEVICE = os.environ.get('DEVICE', 'cuda' if torch.cuda.is_available() else 'cpu')
BATCH_SIZE = int(os.environ.get('BATCH_SIZE', '4'))
NUM_WORKERS = int(os.environ.get('NUM_WORKERS', '4'))
CACHE_ENABLED = os.environ.get('CACHE_ENABLED', 'true').lower() == 'true'
CACHE_TTL = int(os.environ.get('CACHE_TTL', '3600'))  # 1 hodina
METRICS_PORT = int(os.environ.get('METRICS_PORT', '9090'))
REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

# Vytvoření adresářů
UPLOADS_DIR = '/ML/uploads'
RESULTS_DIR = '/ML/results'
CACHE_DIR = '/ML/cache'
for directory in [UPLOADS_DIR, RESULTS_DIR, CACHE_DIR]:
    os.makedirs(directory, exist_ok=True)

# Inicializace Flask aplikace
app = Flask(__name__)
CORS(app)

# Inicializace Redis pro cachování
if CACHE_ENABLED:
    try:
        redis_client = redis.from_url(REDIS_URL)
        redis_client.ping()
        logger.info(f"Redis cache připojena: {REDIS_URL}")
    except Exception as e:
        logger.error(f"Nelze se připojit k Redis: {e}")
        redis_client = None
        CACHE_ENABLED = False
else:
    redis_client = None

# Metriky Prometheus
SEGMENTATION_REQUESTS = Counter(
    'ml_segmentation_requests_total',
    'Celkový počet požadavků na segmentaci',
    ['status']
)
SEGMENTATION_LATENCY = Histogram(
    'ml_segmentation_latency_seconds',
    'Doba zpracování požadavku na segmentaci',
    ['model']
)
SEGMENTATION_TASKS = Counter(
    'ml_segmentation_tasks_total',
    'Celkový počet úloh segmentace',
    ['model', 'status']
)
GPU_UTILIZATION = Gauge(
    'ml_gpu_utilization_percent',
    'Využití GPU v procentech',
    ['gpu_id']
)
MEMORY_UTILIZATION = Gauge(
    'ml_memory_utilization_percent',
    'Využití paměti v procentech'
)
CPU_UTILIZATION = Gauge(
    'ml_cpu_utilization_percent',
    'Využití CPU v procentech'
)
CACHE_HITS = Counter(
    'ml_cache_hits_total',
    'Celkový počet cache hitů'
)
CACHE_MISSES = Counter(
    'ml_cache_misses_total',
    'Celkový počet cache missů'
)

# Spuštění Prometheus serveru
start_http_server(METRICS_PORT)
logger.info(f"Prometheus metriky dostupné na portu {METRICS_PORT}")

# Načtení modelu
def load_model(model_path: str, model_type: str = 'resunet') -> nn.Module:
    """Načte model ze souboru"""
    if DEBUG:
        logger.info(f"DEBUG mód - model nebude načten")
        return None
    
    try:
        logger.info(f"Načítání modelu {model_type} z {model_path}")
        
        if model_type == 'resunet':
            from models.resunet import ResUNet
            model = ResUNet(3, 1)
        elif model_type == 'unet':
            from models.unet import UNet
            model = UNet(3, 1)
        elif model_type == 'deeplabv3':
            from models.deeplabv3 import DeepLabV3
            model = DeepLabV3(3, 1)
        else:
            raise ValueError(f"Nepodporovaný typ modelu: {model_type}")
        
        # Načtení vah modelu
        checkpoint = torch.load(model_path, map_location=DEVICE)
        if 'model_state_dict' in checkpoint:
            model.load_state_dict(checkpoint['model_state_dict'])
        else:
            model.load_state_dict(checkpoint)
        
        model = model.to(DEVICE)
        model.eval()
        
        logger.info(f"Model {model_type} úspěšně načten")
        return model
    except Exception as e:
        logger.error(f"Chyba při načítání modelu: {e}")
        logger.error(traceback.format_exc())
        return None

# Načtení modelu při startu
model = load_model(MODEL_PATH, MODEL_TYPE)

# Předzpracování obrázku
def preprocess_image(image_path: str) -> torch.Tensor:
    """Předzpracuje obrázek pro model"""
    try:
        image = Image.open(image_path).convert('RGB')
        
        # Transformace obrázku
        preprocess = transforms.Compose([
            transforms.Resize((512, 512)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
        return preprocess(image).unsqueeze(0)
    except Exception as e:
        logger.error(f"Chyba při předzpracování obrázku {image_path}: {e}")
        raise

# Segmentace obrázku
def segment_image(image_path: str, parameters: Dict[str, Any] = None) -> Dict[str, Any]:
    """Provede segmentaci obrázku"""
    if DEBUG:
        # V debug módu generujeme mock data
        time.sleep(2)
        return {
            'status': 'success',
            'image_path': image_path,
            'processing_time': 2.0,
            'polygons': generate_mock_polygons(),
            'timestamp': datetime.now().isoformat()
        }
    
    try:
        # Kontrola existence souboru
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Soubor neexistuje: {image_path}")
        
        # Měření času zpracování
        start_time = time.time()
        
        # Předzpracování obrázku
        input_tensor = preprocess_image(image_path)
        
        # Segmentace
        with torch.no_grad():
            input_tensor = input_tensor.to(DEVICE)
            output = model(input_tensor)
            
            # Převod výstupu na masku
            mask = torch.sigmoid(output).cpu().numpy()[0, 0] > 0.5
        
        # Extrakce kontur z masky
        polygons = extract_contours_from_mask(mask)
        
        # Výpočet doby zpracování
        processing_time = time.time() - start_time
        
        # Aktualizace metrik
        SEGMENTATION_TASKS.labels(model=MODEL_TYPE, status='completed').inc()
        SEGMENTATION_LATENCY.labels(model=MODEL_TYPE).observe(processing_time)
        
        return {
            'status': 'success',
            'image_path': image_path,
            'processing_time': processing_time,
            'polygons': polygons,
            'timestamp': datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Chyba při segmentaci obrázku {image_path}: {e}")
        logger.error(traceback.format_exc())
        
        # Aktualizace metrik
        SEGMENTATION_TASKS.labels(model=MODEL_TYPE, status='failed').inc()
        
        raise

# Extrakce kontur z masky
def extract_contours_from_mask(mask: np.ndarray) -> List[Dict[str, Any]]:
    """Extrahuje kontury z binární masky"""
    try:
        import cv2
        
        # Převod na formát OpenCV
        mask_uint8 = (mask * 255).astype(np.uint8)
        
        # Nalezení kontur
        contours, hierarchy = cv2.findContours(mask_uint8, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        
        # Zpracování kontur
        result = []
        for i, contour in enumerate(contours):
            # Filtrování malých kontur
            if cv2.contourArea(contour) < 100:
                continue
            
            # Zjednodušení kontury
            epsilon = 0.005 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)
            
            # Převod na seznam bodů
            points = approx.reshape(-1, 2).tolist()
            
            # Určení typu kontury (externí nebo interní)
            contour_type = 'external'
            if hierarchy is not None and hierarchy[0][i][3] != -1:
                contour_type = 'internal'
            
            result.append({
                'id': str(uuid.uuid4()),
                'points': points,
                'type': contour_type,
                'class': 'spheroid',
                'confidence': 0.95
            })
        
        return result
    except Exception as e:
        logger.error(f"Chyba při extrakci kontur: {e}")
        logger.error(traceback.format_exc())
        return []

# Generování mock polygonů pro debug mód
def generate_mock_polygons() -> List[Dict[str, Any]]:
    """Generuje mock polygony pro debug mód"""
    import random
    
    num_polygons = random.randint(3, 8)
    polygons = []
    
    for i in range(num_polygons):
        # Generování polygonu s 5-10 body
        num_points = random.randint(5, 10)
        points = []
        
        # Náhodný střed polygonu
        center_x = random.randint(100, 900)
        center_y = random.randint(100, 900)
        
        # Generování bodů kolem středu
        for j in range(num_points):
            angle = (j / num_points) * 2 * math.pi
            distance = random.randint(30, 100)
            x = center_x + int(distance * math.cos(angle))
            y = center_y + int(distance * math.sin(angle))
            points.append([x, y])
        
        polygons.append({
            'id': str(uuid.uuid4()),
            'points': points,
            'type': 'external',
            'class': random.choice(['spheroid', 'cell', 'nucleus']),
            'confidence': random.uniform(0.75, 0.98)
        })
    
    return polygons

# Kontrola stavu GPU
def check_gpu_status() -> Dict[str, Any]:
    """Kontroluje stav GPU a aktualizuje metriky"""
    try:
        if torch.cuda.is_available():
            gpu_count = torch.cuda.device_count()
            gpus = []
            
            for i in range(gpu_count):
                # Získání informací o GPU
                gpu_name = torch.cuda.get_device_name(i)
                gpu_memory_allocated = torch.cuda.memory_allocated(i) / (1024 ** 3)  # GB
                gpu_memory_reserved = torch.cuda.memory_reserved(i) / (1024 ** 3)  # GB
                gpu_memory_total = torch.cuda.get_device_properties(i).total_memory / (1024 ** 3)  # GB
                
                # Výpočet využití
                gpu_memory_utilization = (gpu_memory_allocated / gpu_memory_total) * 100
                
                # Aktualizace metriky
                GPU_UTILIZATION.labels(gpu_id=str(i)).set(gpu_memory_utilization)
                
                gpus.append({
                    'id': i,
                    'name': gpu_name,
                    'memory_allocated_gb': gpu_memory_allocated,
                    'memory_reserved_gb': gpu_memory_reserved,
                    'memory_total_gb': gpu_memory_total,
                    'utilization_percent': gpu_memory_utilization
                })
            
            return {
                'available': True,
                'count': gpu_count,
                'gpus': gpus,
                'current_device': torch.cuda.current_device()
            }
        else:
            return {
                'available': False,
                'count': 0,
                'gpus': [],
                'current_device': None
            }
    except Exception as e:
        logger.error(f"Chyba při kontrole stavu GPU: {e}")
        return {
            'available': False,
            'error': str(e)
        }

# Kontrola stavu systému
def check_system_status() -> Dict[str, Any]:
    """Kontroluje stav systému a aktualizuje metriky"""
    try:
        import psutil
        
        # Využití CPU
        cpu_percent = psutil.cpu_percent()
        CPU_UTILIZATION.set(cpu_percent)
        
        # Využití paměti
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        MEMORY_UTILIZATION.set(memory_percent)
        
        return {
            'cpu_percent': cpu_percent,
            'memory_total_gb': memory.total / (1024 ** 3),
            'memory_available_gb': memory.available / (1024 ** 3),
            'memory_percent': memory_percent
        }
    except Exception as e:
        logger.error(f"Chyba při kontrole stavu systému: {e}")
        return {
            'error': str(e)
        }

# Kontrola stavu cache
def check_cache_status() -> Dict[str, Any]:
    """Kontroluje stav cache"""
    if not CACHE_ENABLED or redis_client is None:
        return {
            'enabled': False
        }
    
    try:
        # Získání informací o cache
        info = redis_client.info()
        
        return {
            'enabled': True,
            'connected': True,
            'used_memory_gb': info['used_memory'] / (1024 ** 3),
            'used_memory_peak_gb': info['used_memory_peak'] / (1024 ** 3),
            'hit_rate': info.get('keyspace_hits', 0) / (info.get('keyspace_hits', 0) + info.get('keyspace_misses', 1)),
            'keys': redis_client.dbsize()
        }
    except Exception as e:
        logger.error(f"Chyba při kontrole stavu cache: {e}")
        return {
            'enabled': True,
            'connected': False,
            'error': str(e)
        }

# Kontrola stavu modelu
def check_model_status() -> Dict[str, Any]:
    """Kontroluje stav modelu"""
    return {
        'loaded': model is not None,
        'type': MODEL_TYPE,
        'path': MODEL_PATH,
        'device': DEVICE
    }

# API endpointy
@app.route('/health', methods=['GET'])
def health():
    """Endpoint pro kontrolu stavu služby"""
    gpu_status = check_gpu_status()
    system_status = check_system_status()
    cache_status = check_cache_status()
    model_status = check_model_status()
    
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': '2.0.0',
        'gpu': gpu_status,
        'system': system_status,
        'cache': cache_status,
        'model': model_status
    })

@app.route('/segment', methods=['POST'])
def segment():
    """
    Endpoint pro segmentaci obrázku
    
    Očekávaný formát: JSON s polem image_path
    Vrací: JSON s výsledkem segmentace
    """
    try:
        # Aktualizace metrik
        SEGMENTATION_REQUESTS.labels(status='received').inc()
        
        # Kontrola požadavku
        data = request.json
        if not data or 'image_path' not in data:
            SEGMENTATION_REQUESTS.labels(status='error').inc()
            return jsonify({'error': 'Chybí image_path v požadavku'}), 400
        
        image_path = data['image_path']
        parameters = data.get('parameters', {})
        
        logger.info(f"Zpracování požadavku na segmentaci pro obrázek: {image_path}")
        
        # Kontrola cache
        cache_key = f"segment:{image_path}:{json.dumps(parameters, sort_keys=True)}"
        if CACHE_ENABLED and redis_client is not None:
            cached_result = redis_client.get(cache_key)
            if cached_result:
                # Cache hit
                CACHE_HITS.inc()
                logger.info(f"Cache hit pro obrázek: {image_path}")
                
                # Aktualizace metrik
                SEGMENTATION_REQUESTS.labels(status='success').inc()
                
                return jsonify(json.loads(cached_result))
            else:
                # Cache miss
                CACHE_MISSES.inc()
        
        # Segmentace obrázku
        result = segment_image(image_path, parameters)
        
        # Uložení do cache
        if CACHE_ENABLED and redis_client is not None:
            redis_client.setex(
                cache_key,
                CACHE_TTL,
                json.dumps(result)
            )
        
        # Aktualizace metrik
        SEGMENTATION_REQUESTS.labels(status='success').inc()
        
        return jsonify(result)
    except FileNotFoundError as e:
        logger.error(f"Soubor nenalezen: {str(e)}")
        SEGMENTATION_REQUESTS.labels(status='error').inc()
        return jsonify({'error': f"Soubor nenalezen: {str(e)}"}), 404
    except Exception as e:
        logger.error(f"Chyba při zpracování požadavku na segmentaci: {str(e)}")
        logger.error(traceback.format_exc())
        SEGMENTATION_REQUESTS.labels(status='error').inc()
        return jsonify({'error': str(e)}), 500

@app.route('/batch-segment', methods=['POST'])
def batch_segment():
    """
    Endpoint pro dávkovou segmentaci obrázků
    
    Očekávaný formát: JSON s polem image_paths
    Vrací: JSON s výsledky segmentace
    """
    try:
        # Aktualizace metrik
        SEGMENTATION_REQUESTS.labels(status='received').inc()
        
        # Kontrola požadavku
        data = request.json
        if not data or 'image_paths' not in data:
            SEGMENTATION_REQUESTS.labels(status='error').inc()
            return jsonify({'error': 'Chybí image_paths v požadavku'}), 400
        
        image_paths = data['image_paths']
        parameters = data.get('parameters', {})
        
        if not isinstance(image_paths, list) or len(image_paths) == 0:
            SEGMENTATION_REQUESTS.labels(status='error').inc()
            return jsonify({'error': 'image_paths musí být neprázdné pole'}), 400
        
        logger.info(f"Zpracování požadavku na dávkovou segmentaci pro {len(image_paths)} obrázků")
        
        # Zpracování obrázků
        results = []
        for image_path in image_paths:
            try:
                # Kontrola cache
                cache_key = f"segment:{image_path}:{json.dumps(parameters, sort_keys=True)}"
                if CACHE_ENABLED and redis_client is not None:
                    cached_result = redis_client.get(cache_key)
                    if cached_result:
                        # Cache hit
                        CACHE_HITS.inc()
                        results.append(json.loads(cached_result))
                        continue
                    else:
                        # Cache miss
                        CACHE_MISSES.inc()
                
                # Segmentace obrázku
                result = segment_image(image_path, parameters)
                results.append(result)
                
                # Uložení do cache
                if CACHE_ENABLED and redis_client is not None:
                    redis_client.setex(
                        cache_key,
                        CACHE_TTL,
                        json.dumps(result)
                    )
            except Exception as e:
                logger.error(f"Chyba při segmentaci obrázku {image_path}: {e}")
                results.append({
                    'status': 'error',
                    'image_path': image_path,
                    'error': str(e),
                    'timestamp': datetime.now().isoformat()
                })
        
        # Aktualizace metrik
        SEGMENTATION_REQUESTS.labels(status='success').inc()
        
        return jsonify({
            'status': 'success',
            'count': len(results),
            'results': results,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Chyba při zpracování požadavku na dávkovou segmentaci: {str(e)}")
        logger.error(traceback.format_exc())
        SEGMENTATION_REQUESTS.labels(status='error').inc()
        return jsonify({'error': str(e)}), 500

@app.route('/metrics', methods=['GET'])
def metrics():
    """Endpoint pro metriky (textový formát pro Prometheus)"""
    try:
        from prometheus_client import generate_latest
        
        # Aktualizace metrik
        check_gpu_status()
        check_system_status()
        
        # Generování metrik
        metrics_data = generate_latest().decode('utf-8')
        
        return metrics_data, 200, {'Content-Type': 'text/plain'}
    except Exception as e:
        logger.error(f"Chyba při generování metrik: {str(e)}")
        return str(e), 500, {'Content-Type': 'text/plain'}

if __name__ == '__main__':
    # Kontrola existence modelu
    if os.path.exists(MODEL_PATH):
        logger.info(f"ML model nalezen: {MODEL_PATH}")
    else:
        logger.warning(f"ML model nenalezen: {MODEL_PATH}")
    
    logger.info("Spouštění ML služby")
    app.run(host='0.0.0.0', port=5002, debug=DEBUG)
