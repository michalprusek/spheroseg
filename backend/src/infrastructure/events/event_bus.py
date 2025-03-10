from typing import Callable, Dict, List
import json
from kafka import KafkaProducer, KafkaConsumer
from ..config import settings

class EventBus:
    def __init__(self):
        self.producer = KafkaProducer(
            bootstrap_servers=settings.KAFKA_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        
        self.consumers: Dict[str, List[Callable]] = {}
        self._setup_consumers()

    def _setup_consumers(self):
        self.consumer = KafkaConsumer(
            bootstrap_servers=settings.KAFKA_SERVERS,
            value_deserializer=lambda v: json.loads(v.decode('utf-8')),
            group_id=settings.SERVICE_NAME,
            auto_offset_reset='latest'
        )

    async def publish(self, topic: str, event: Dict):
        """Publikuje událost do Kafka"""
        try:
            future = self.producer.send(topic, event)
            await future
        except Exception as e:
            print(f"Failed to publish event: {e}")
            raise

    async def subscribe(self, topic: str, handler: Callable):
        """Přihlásí handler k odběru událostí"""
        if topic not in self.consumers:
            self.consumers[topic] = []
            self.consumer.subscribe([topic])
        
        self.consumers[topic].append(handler)

    async def start_consuming(self):
        """Spustí konzumaci událostí"""
        for message in self.consumer:
            topic = message.topic
            if topic in self.consumers:
                event = message.value
                for handler in self.consumers[topic]:
                    try:
                        await handler(event)
                    except Exception as e:
                        print(f"Error handling event: {e}")

    async def stop(self):
        """Zastaví event bus"""
        self.producer.close()
        self.consumer.close()