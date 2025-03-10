from typing import Any, Dict
from datetime import datetime
import json
from elasticsearch import Elasticsearch
from ..config import settings

class AuditLogger:
    def __init__(self):
        self.es = Elasticsearch([settings.ELASTICSEARCH_URL])
        self.index_prefix = "audit-logs-"

    async def log_event(
        self,
        event_type: str,
        user_id: int,
        resource_type: str,
        resource_id: str,
        action: str,
        details: Dict[str, Any]
    ):
        """Zaloguje audit event"""
        timestamp = datetime.utcnow()
        index_name = f"{self.index_prefix}{timestamp.strftime('%Y-%m')}"
        
        document = {
            "timestamp": timestamp,
            "event_type": event_type,
            "user_id": user_id,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "action": action,
            "details": details,
            "ip_address": self._get_ip_address(),
            "user_agent": self._get_user_agent()
        }
        
        try:
            self.es.index(
                index=index_name,
                document=document
            )
        except Exception as e:
            # Fallback to file logging if ES fails
            self._log_to_file(document)

    def _log_to_file(self, document: Dict):
        """Záložní logging do souboru"""
        with open(settings.AUDIT_LOG_FILE, 'a') as f:
            f.write(json.dumps(document) + '\n')

    def get_audit_trail(
        self,
        resource_type: str,
        resource_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict]:
        """Získá audit trail pro daný zdroj"""
        query = {
            "bool": {
                "must": [
                    {"match": {"resource_type": resource_type}},
                    {"match": {"resource_id": resource_id}},
                    {
                        "range": {
                            "timestamp": {
                                "gte": start_date.isoformat(),
                                "lte": end_date.isoformat()
                            }
                        }
                    }
                ]
            }
        }
        
        results = self.es.search(
            index=f"{self.index_prefix}*",
            query=query,
            size=1000,
            sort=[{"timestamp": "desc"}]
        )
        
        return [hit["_source"] for hit in results["hits"]["hits"]]