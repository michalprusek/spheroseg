from typing import List, Dict, Any, Optional
from sqlalchemy import and_, or_, func
from sqlalchemy.orm import Session
from ...domain.schemas.search import SearchQuery, FilterCondition, ComparisonOperator
from ...infrastructure.models.image import ImageModel
from ...infrastructure.models.project import ProjectModel

class SearchService:
    @staticmethod
    def build_filter_condition(model: Any, condition: FilterCondition):
        field = getattr(model, condition.field)
        
        if condition.operator == ComparisonOperator.EQ:
            return field == condition.value
        elif condition.operator == ComparisonOperator.GT:
            return field > condition.value
        elif condition.operator == ComparisonOperator.LT:
            return field < condition.value
        elif condition.operator == ComparisonOperator.GTE:
            return field >= condition.value
        elif condition.operator == ComparisonOperator.LTE:
            return field <= condition.value
        elif condition.operator == ComparisonOperator.BETWEEN:
            return and_(field >= condition.value[0], field <= condition.value[1])
        elif condition.operator == ComparisonOperator.IN:
            return field.in_(condition.value)
        
        raise ValueError(f"Nepodporovaný operátor: {condition.operator}")

    def search_images(self, db: Session, project_id: int, query: SearchQuery) -> Dict[str, Any]:
        base_query = db.query(ImageModel).filter(ImageModel.project_id == project_id)
        
        # Aplikace filtrů
        for condition in query.filters:
            filter_condition = self.build_filter_condition(ImageModel, condition)
            base_query = base_query.filter(filter_condition)
        
        # Počet celkových výsledků
        total = base_query.count()
        
        # Řazení
        if query.sort_by:
            sort_field = getattr(ImageModel, query.sort_by)
            if query.sort_order == "desc":
                sort_field = sort_field.desc()
            base_query = base_query.order_by(sort_field)
        
        # Stránkování
        results = base_query.offset((query.page - 1) * query.page_size)\
                          .limit(query.page_size)\
                          .all()
        
        # Agregace
        aggregations = {
            "processing_status": {
                status: db.query(func.count(ImageModel.id))
                         .filter(ImageModel.project_id == project_id)
                         .filter(ImageModel.processing_status == status)
                         .scalar()
                for status in ["pending", "processing", "completed", "failed"]
            },
            "statistics": {
                "avg_sphere_count": db.query(func.avg(ImageModel.sphere_count))
                                   .filter(ImageModel.project_id == project_id)
                                   .scalar(),
                "avg_diameter": db.query(func.avg(ImageModel.average_diameter))
                                .filter(ImageModel.project_id == project_id)
                                .scalar()
            }
        }
        
        return {
            "total": total,
            "page": query.page,
            "page_size": query.page_size,
            "results": [self.serialize_image(img) for img in results],
            "aggregations": aggregations
        }

    @staticmethod
    def serialize_image(image: ImageModel) -> Dict[str, Any]:
        return {
            "id": image.id,
            "filename": image.filename,
            "processing_status": image.processing_status,
            "created_at": image.created_at.isoformat(),
            "sphere_count": image.sphere_count,
            "average_diameter": image.average_diameter,
            "analysis_results": image.analysis_results
        }