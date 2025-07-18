# Integration Tests for Resegmentation Workflow

This document describes the integration tests added for the resegmentation workflow based on PR review feedback.

## Overview

Integration tests have been added to verify the complete resegmentation workflow, including:

1. **Backend Integration Tests** (`packages/backend/src/tests/integration/resegment.integration.test.ts`)
   - Initial segmentation verification
   - Resegmentation API endpoint functionality
   - Old data cleanup verification
   - WebSocket status updates
   - Queue management
   - Error handling

2. **Frontend Integration Tests** (`packages/frontend/src/__tests__/integration/resegment.integration.test.tsx`)
   - Resegment button behavior
   - Spinner animation during processing
   - WebSocket status updates
   - UI state management
   - Error handling and recovery

## Running Integration Tests

### Backend Integration Tests

```bash
# Run all backend tests
cd packages/backend
npm test

# Run only integration tests
npm run test:integration

# Run only unit tests (excluding integration)
npm run test:unit

# Run with coverage
npm run test:coverage
```

### Frontend Integration Tests

```bash
# Run all frontend tests
cd packages/frontend
npm test

# Run only integration tests
npm run test:integration

# Run only unit tests (excluding integration)
npm run test:unit

# Run with coverage
npm run test:coverage
```

### Running All Tests from Root

```bash
# From project root
npm test

# Run all integration tests
npm run test:backend -- --testPathPattern=integration
npm run test:frontend -- --testPathPattern=integration
```

## Test Coverage

The integration tests cover:

### Backend Coverage
- ✅ Resegmentation endpoint (`POST /api/segmentation/:imageId/resegment`)
- ✅ Old segmentation data deletion
- ✅ Queue status updates
- ✅ WebSocket notifications
- ✅ Duplicate request prevention
- ✅ Error handling and recovery
- ✅ Status transitions (queued → processing → completed)

### Frontend Coverage
- ✅ Resegment button states (normal, spinner)
- ✅ Status-based UI updates
- ✅ WebSocket integration
- ✅ API call handling
- ✅ Custom event dispatching
- ✅ Error state management
- ✅ End-to-end workflow

## Key Test Scenarios

1. **Initial Segmentation Exists**
   - Verifies old data is properly deleted
   - Confirms new segmentation task is created

2. **No Previous Segmentation**
   - Tests resegmentation on images without prior segmentation
   - Verifies proper initialization

3. **Concurrent Requests**
   - Prevents duplicate resegmentation tasks
   - Ensures queue integrity

4. **Error Handling**
   - ML service unavailable
   - Network failures
   - Invalid image IDs

5. **Real-time Updates**
   - WebSocket status notifications
   - UI spinner animations
   - Queue status synchronization

## Test Database Setup

Integration tests use a test database that should be configured in your test environment:

```bash
# Test database configuration
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/spheroseg_test
```

Tests automatically:
- Create test users, projects, and images
- Clean up test data after completion
- Mock external services (ML service)

## Continuous Integration

These tests are automatically run in CI/CD pipelines:

```yaml
# Example GitHub Actions configuration
- name: Run Backend Integration Tests
  run: |
    cd packages/backend
    npm run test:integration

- name: Run Frontend Integration Tests
  run: |
    cd packages/frontend
    npm run test:integration
```

## Future Improvements

Potential areas for expanding test coverage:

1. **Performance Tests**
   - Load testing with multiple concurrent resegmentations
   - Memory usage during large batch operations

2. **Edge Cases**
   - Network interruptions during resegmentation
   - Database connection failures
   - File system errors

3. **Cross-Service Integration**
   - Full ML service integration (without mocks)
   - Multi-user scenarios
   - Real WebSocket connections

## Troubleshooting

Common issues and solutions:

1. **Database Connection Errors**
   - Ensure test database is running
   - Check database permissions
   - Verify connection string

2. **WebSocket Mock Failures**
   - Update socket.io-client mocks
   - Check event handler signatures

3. **Timing Issues**
   - Increase `waitFor` timeouts
   - Add proper async/await handling
   - Use act() for React state updates