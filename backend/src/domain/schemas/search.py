from typing import List, Optional, Union, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field
from datetime import datetime

class ComparisonOperator(str, Enum):
    EQ = "eq"  # equals
    GT = "gt"  # greater than
    LT = "lt"  # less than
    GTE = "gte"  # greater than or equal
    LTE = "lte"  # less than or equal
    BETWEEN = "between"  # between two values
    IN = "in"  # in list of values

class SortOrder(str, Enum):
    ASC = "asc"
    DESC = "desc"

class FilterCondition(BaseModel):
    field: str
    operator: ComparisonOperator
    value: Union[float, int, str, List[Union[float, int, str]]]

class SearchQuery(BaseModel):
    filters: List[FilterCondition] = Field(default_factory=list)
    sort_by: Optional[str] = None
    sort_order: Optional[SortOrder] = SortOrder.ASC
    page: int = 1
    page_size: int = 50
    
class SearchResults(BaseModel):
    total: int
    page: int
    page_size: int
    results: List[Dict[str, Any]]
    aggregations: Optional[Dict[str, Any]] = None