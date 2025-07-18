# Message Queue Implementation for SpherosegV4

## Overview

This document describes the RabbitMQ message queue implementation for asynchronous ML task processing in SpherosegV4. The implementation replaces synchronous HTTP calls and database polling with a robust message-driven architecture.

## Architecture

### Message Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Backend   │────▶│  RabbitMQ   │────▶│ ML Service  │
│  (Producer) │     │   Broker    │     │ (Consumer)  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Task Queue │     │ Result Queue│     │Dead Letter Q│
└─────────────┘     └─────────────┘     └─────────────┘
```

### Exchanges and Queues

1. **Exchanges:**
   - `segmentation` - Main exchange for all segmentation-related messages
   - `segmentation.dlx` - Dead letter exchange for failed messages

2. **Queues:**
   - `segmentation.tasks` - Incoming segmentation tasks
   - `segmentation.results` - Processing results (success/failure)
   - `segmentation.dlq` - Dead letter queue for failed messages

3. **Routing Keys:**
   - `task.new` - New segmentation task
   - `task.completed` - Successfully processed task
   - `task.failed` - Failed task

## Implementation Details

### Backend Service (Producer)

The `MessageQueueService` in the backend handles:
- Publishing segmentation tasks to the queue
- Consuming processing results
- Managing dead letter messages
- Providing queue metrics

Key features:
- Automatic reconnection on connection loss
- Message persistence for reliability
- Priority queuing for premium users
- Comprehensive error handling

### ML Service (Consumer)

The `message_queue_consumer.py` script:
- Consumes tasks from the segmentation queue
- Processes images through the ML pipeline
- Publishes results back to the queue
- Handles failures gracefully

Key features:
- Single message processing (prefetch=1)
- 5-minute timeout for ML processing
- Automatic retry with exponential backoff
- Dead letter queue for permanent failures

### Database Integration

New tables and columns support the message queue:
- `segmentation_failures` - Tracks retry attempts
- `segmentation_tasks.message_queue_id` - Links to RabbitMQ messages
- `segmentation_tasks.retry_count` - Tracks retry attempts
- `segmentation_tasks.processing_time_ms` - Performance metrics

## Deployment

### 1. Start RabbitMQ

```bash
docker-compose -f docker-compose.yml -f docker-compose.rabbitmq.yml up -d rabbitmq
```

### 2. Apply Database Migrations

```bash
docker-compose exec db psql -U postgres -d spheroseg -f /scripts/postgres/migrations/010_add_message_queue_tables.sql
```

### 3. Update Backend Service

Environment variables:
```bash
ENABLE_MESSAGE_QUEUE=true
RABBITMQ_URL=amqp://spheroseg:spheroseg_secret@rabbitmq:5672/spheroseg
```

### 4. Start ML Consumer

In the ML service container:
```bash
python message_queue_consumer.py
```

Or add to ML service startup:
```dockerfile
CMD ["sh", "-c", "python message_queue_consumer.py & python app.py"]
```

## Configuration

### RabbitMQ Settings

Key configurations in `rabbitmq.conf`:
- Memory limit: 512MB
- Message TTL: 1 hour for tasks, 24 hours for dead letters
- Max message size: 128MB
- Queue length limits to prevent overflow

### Priority Queuing

Tasks are prioritized based on user tier:
- Premium users: Priority 10
- Regular users: Priority 1

### Dead Letter Handling

Failed messages are sent to DLQ after:
- Processing errors (immediate)
- Message TTL expiration (1 hour)
- Queue length exceeded

Messages in DLQ are:
- Retried up to 3 times
- Logged for debugging
- Permanently failed after max retries

## Monitoring

### RabbitMQ Management UI

Access at: http://localhost:15672
- Username: spheroseg
- Password: spheroseg_secret

Monitor:
- Queue depths
- Message rates
- Consumer status
- Memory usage

### Prometheus Metrics

The RabbitMQ exporter provides metrics at: http://localhost:9419/metrics

Key metrics:
- `rabbitmq_queue_messages` - Messages in queue
- `rabbitmq_queue_consumers` - Active consumers
- `rabbitmq_queue_message_stats_publish` - Publish rate
- `rabbitmq_queue_message_stats_deliver_get` - Delivery rate

### Application Metrics

Access via the API:
```bash
GET /api/admin/queue/metrics
```

Returns:
- Queue status (connected/disconnected)
- Message counts by queue
- Published/consumed/error counts
- Database task statistics

## Failure Scenarios

### RabbitMQ Unavailable

1. Backend falls back to database queue
2. Existing connections retry with exponential backoff
3. Health checks report degraded status
4. Manual intervention may be required

### ML Service Failure

1. Messages are nacked and sent to DLQ
2. Retry logic attempts reprocessing
3. After max retries, task marked as failed
4. User notified via WebSocket

### Network Partition

1. RabbitMQ heartbeat detects disconnection
2. Consumers automatically reconnect
3. Unacknowledged messages are requeued
4. No message loss during partition

## Performance Tuning

### Scaling Consumers

Add more ML service instances:
```yaml
ml:
  deploy:
    replicas: 3
```

Each instance runs a consumer for parallel processing.

### Queue Optimization

For high throughput:
1. Increase `channel_max` for more channels
2. Adjust `vm_memory_high_watermark` for more buffering
3. Enable `lazy_queue_default` for disk-backed queues
4. Use multiple queues with routing for load distribution

### Connection Pooling

The backend uses a single persistent connection with multiple channels for efficiency.

## Troubleshooting

### Common Issues

1. **"Channel closed by broker"**
   - Check memory usage
   - Verify queue limits not exceeded
   - Review RabbitMQ logs

2. **"Connection refused"**
   - Verify RabbitMQ is running
   - Check network connectivity
   - Validate credentials

3. **Messages stuck in queue**
   - Check consumer health
   - Verify message format
   - Look for processing errors

### Debug Commands

```bash
# List queues
docker-compose exec rabbitmq rabbitmqctl list_queues

# Check connections
docker-compose exec rabbitmq rabbitmqctl list_connections

# View queue details
docker-compose exec rabbitmq rabbitmqctl list_queues name messages consumers

# Purge queue (careful!)
docker-compose exec rabbitmq rabbitmqctl purge_queue segmentation.dlq
```

## Future Improvements

1. **Message Compression** - Reduce network traffic for large payloads
2. **Batch Processing** - Process multiple images in one ML invocation
3. **Smart Routing** - Route tasks based on image characteristics
4. **Federated Queues** - Multi-datacenter support
5. **Stream Processing** - Use RabbitMQ Streams for event sourcing

## Rollback Procedure

If issues arise:

1. Stop consumers:
   ```bash
   docker-compose stop ml
   ```

2. Disable message queue:
   ```bash
   # Set in backend environment
   ENABLE_MESSAGE_QUEUE=false
   ```

3. Rollback database:
   ```bash
   docker-compose exec db psql -U postgres -d spheroseg -f /scripts/postgres/rollback/010_add_message_queue_tables_rollback.sql
   ```

4. Restart services:
   ```bash
   docker-compose restart backend
   ```

The system will revert to database polling automatically.