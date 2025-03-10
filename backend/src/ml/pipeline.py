from typing import List, Dict, Any
import numpy as np
import torch
from PIL import Image
from .models import SegmentationModel, ClassificationModel
from ..core.image_processing import ImagePreprocessor
from ..infrastructure.cache import RedisCache

class MLPipeline:
    def __init__(self):
        self.segmentation_model = SegmentationModel()
        self.classification_model = ClassificationModel()
        self.preprocessor = ImagePreprocessor()
        self.cache = RedisCache()

    async def process_image(self, image: Image.Image) -> Dict[str, Any]:
        """Zpracuje obrázek přes ML pipeline"""
        # Check cache
        image_hash = self.preprocessor.compute_hash(image)
        cached_result = await self.cache.get(f"ml_result:{image_hash}")
        if cached_result:
            return cached_result

        # Preprocess image
        processed_image = self.preprocessor.process(image)
        
        # Run segmentation
        with torch.no_grad():
            segments = self.segmentation_model(processed_image)
        
        # Analyze segments
        results = []
        for segment in segments:
            # Extract segment features
            features = self.preprocessor.extract_features(segment)
            
            # Run classification
            classification = self.classification_model(features)
            
            # Measure properties
            properties = self.measure_segment_properties(segment)
            
            results.append({
                "classification": classification,
                "properties": properties,
                "confidence": float(classification.confidence)
            })

        # Cache results
        final_result = {
            "segments_count": len(results),
            "segments": results,
            "analysis_metadata": {
                "model_version": self.segmentation_model.version,
                "processing_timestamp": datetime.utcnow().isoformat()
            }
        }
        
        await self.cache.set(
            f"ml_result:{image_hash}",
            final_result,
            expire=timedelta(hours=24)
        )

        return final_result

    def measure_segment_properties(self, segment: np.ndarray) -> Dict:
        """Měří vlastnosti segmentu"""
        return {
            "area": float(np.sum(segment)),
            "centroid": tuple(map(float, np.mean(np.where(segment), axis=1))),
            "circularity": self._calculate_circularity(segment),
            "intensity_stats": self._calculate_intensity_stats(segment)
        }

    def _calculate_circularity(self, segment: np.ndarray) -> float:
        """Vypočítá kruhovitost segmentu"""
        contours = cv2.findContours(
            segment.astype(np.uint8),
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE
        )[0]
        
        if not contours:
            return 0.0
            
        contour = contours[0]
        area = cv2.contourArea(contour)
        perimeter = cv2.arcLength(contour, True)
        
        if perimeter == 0:
            return 0.0
            
        circularity = 4 * np.pi * area / (perimeter * perimeter)
        return float(circularity)

    def _calculate_intensity_stats(self, segment: np.ndarray) -> Dict:
        """Vypočítá statistiky intenzity"""
        return {
            "mean": float(np.mean(segment)),
            "std": float(np.std(segment)),
            "min": float(np.min(segment)),
            "max": float(np.max(segment))
        }