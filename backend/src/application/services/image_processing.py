import cv2
import numpy as np
from typing import Tuple, List, Dict, Any
from ...domain.entities.image import Image

class ImageProcessor:
    @staticmethod
    def detect_spheres(image_data: np.ndarray) -> Tuple[int, float, List[Dict[str, Any]]]:
        # Převod na šedotónový obrázek
        gray = cv2.cvtColor(image_data, cv2.COLOR_BGR2GRAY)
        
        # Aplikace Gaussova rozostření
        blurred = cv2.GaussianBlur(gray, (9, 9), 2)
        
        # Detekce kruhů pomocí Houghovy transformace
        circles = cv2.HoughCircles(
            blurred,
            cv2.HOUGH_GRADIENT,
            dp=1,
            minDist=50,
            param1=50,
            param2=30,
            minRadius=20,
            maxRadius=100
        )
        
        if circles is None:
            return 0, 0.0, []
        
        circles = np.round(circles[0, :]).astype(int)
        
        # Zpracování výsledků
        sphere_count = len(circles)
        diameters = [circle[2] * 2 for circle in circles]
        average_diameter = np.mean(diameters) if sphere_count > 0 else 0.0
        
        # Vytvoření detailních výsledků
        results = []
        for x, y, r in circles:
            results.append({
                "center_x": int(x),
                "center_y": int(y),
                "radius": int(r),
                "diameter": float(r * 2)
            })
        
        return sphere_count, float(average_diameter), results

    @staticmethod
    def process_image(image: Image) -> Dict[str, Any]:
        try:
            # Načtení obrázku
            image_data = cv2.imread(image.storage_path)
            if image_data is None:
                raise ValueError("Nelze načíst obrázek")
            
            # Detekce sfér
            sphere_count, avg_diameter, details = ImageProcessor.detect_spheres(image_data)
            
            return {
                "status": "completed",
                "sphere_count": sphere_count,
                "average_diameter": avg_diameter,
                "details": details
            }
        except Exception as e:
            return {
                "status": "failed",
                "error": str(e)
            }