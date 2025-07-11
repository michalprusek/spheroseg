# ML Service Test Suite

Comprehensive test suite for the SpherosegV4 ML service, covering ResUNet model, segmentation pipeline, RabbitMQ integration, and Flask API endpoints.

## Test Structure

```
tests/
├── conftest.py                              # Pytest configuration and fixtures
├── test_resunet.py                         # ResUNet model architecture tests
├── test_segmentation_pipeline.py           # Segmentation pipeline tests
├── test_extract_polygons.py                # Polygon extraction tests
├── test_ml_service.py                      # Flask API endpoint tests
├── test_rabbitmq_integration.py            # RabbitMQ message processing tests
├── test_extract_polygons_comprehensive.py   # Comprehensive polygon tests
├── test_ml_service_comprehensive.py         # Comprehensive service tests
├── test_resunet_segmentation_comprehensive.py # Comprehensive segmentation tests
└── run_tests.py                            # Test runner script
```

## Setup

### 1. Create Virtual Environment

```bash
cd packages/ml
./setup_test_env.sh
```

### 2. Activate Environment

```bash
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements-test.txt
```

## Running Tests

### Run All Tests

```bash
python -m pytest tests/ -v
```

### Run with Coverage

```bash
python -m pytest tests/ --cov=. --cov-report=html -v
```

### Run Specific Test File

```bash
python -m pytest tests/test_ml_service.py -v
```

### Run Tests by Marker

```bash
# Unit tests only
python -m pytest tests/ -m unit -v

# Integration tests only
python -m pytest tests/ -m integration -v

# Skip slow tests
python -m pytest tests/ -m "not slow" -v

# Skip tests requiring RabbitMQ
python -m pytest tests/ -m "not rabbitmq" -v
```

### Using the Test Runner

```bash
# Run all tests with coverage
python tests/run_tests.py -c -v

# Run specific test file
python tests/run_tests.py test_resunet.py -v

# Run with markers
python tests/run_tests.py -m "not slow" -v
```

## Test Categories

### 1. Model Tests (`test_resunet.py`)
- ResidualBlock functionality
- ResUNet architecture validation
- Forward pass with different input sizes
- Gradient flow verification
- Model save/load functionality
- Device compatibility (CPU/GPU)
- Parameter counting

### 2. Segmentation Pipeline Tests
- Image preprocessing (RGB, grayscale, RGBA)
- Complete segmentation pipeline
- Batch processing
- Error handling
- Performance metrics
- Memory usage monitoring

### 3. Polygon Extraction Tests
- Contour simplification
- Point format conversion
- Feature calculation (area, perimeter, circularity, etc.)
- Hierarchical polygon extraction (with holes)
- Edge case handling

### 4. ML Service Tests
- Flask health endpoint
- Mock polygon generation
- RabbitMQ message processing
- Error recovery mechanisms
- Concurrent processing
- Performance monitoring

### 5. Integration Tests
- End-to-end segmentation workflow
- RabbitMQ connection and retry logic
- Callback mechanism
- File I/O operations
- Docker environment compatibility

## Test Fixtures

### Common Fixtures

```python
@pytest.fixture
def mock_model():
    """Mock ResUNet model for testing."""
    
@pytest.fixture
def test_image():
    """Create test image for segmentation."""
    
@pytest.fixture
def temp_upload_dir():
    """Temporary directory for file operations."""
```

## Coverage Goals

- **Target Coverage**: >80% for all modules
- **Critical Paths**: 100% coverage for:
  - Model loading and inference
  - Message processing
  - Error handling
  - Polygon extraction

## Performance Benchmarks

### Expected Performance

- Model loading: < 5 seconds
- Single image segmentation: < 2 seconds (CPU)
- Polygon extraction: < 100ms per image
- Memory usage: < 2GB for standard operations

### Performance Tests

```bash
# Run performance benchmarks
python -m pytest tests/ -m performance -v
```

## Debugging Tests

### Enable Verbose Output

```bash
python -m pytest tests/ -v -s
```

### Run with Debugger

```python
import pdb; pdb.set_trace()  # Add to test code
python -m pytest tests/test_file.py -s
```

### Check Test Discovery

```bash
python -m pytest tests/ --collect-only
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run ML Tests
  run: |
    cd packages/ml
    python -m pip install -r requirements-test.txt
    python -m pytest tests/ --cov=. --cov-report=xml
```

### Docker Testing

```bash
# Run tests in Docker container
docker-compose exec ml python -m pytest /ML/tests/ -v
```

## Common Issues

### 1. Import Errors
- Ensure PYTHONPATH includes parent directory
- Check that `__init__.py` files exist

### 2. Model File Not Found
- Mock model loading in tests
- Use test fixtures for model paths

### 3. RabbitMQ Connection Errors
- Use mocks for RabbitMQ in unit tests
- Skip integration tests if RabbitMQ unavailable

### 4. CUDA/GPU Errors
- Set `DEVICE_PREFERENCE=cpu` for tests
- Mock CUDA availability

## Writing New Tests

### Test Template

```python
class TestNewFeature:
    """Test new feature functionality."""
    
    @pytest.fixture
    def setup_data(self):
        """Setup test data."""
        # Setup code
        yield data
        # Teardown code
    
    def test_feature_success(self, setup_data):
        """Test successful feature execution."""
        # Test implementation
        
    def test_feature_error_handling(self):
        """Test error handling."""
        with pytest.raises(ExpectedException):
            # Test error case
```

### Best Practices

1. **Isolation**: Each test should be independent
2. **Mocking**: Mock external dependencies
3. **Assertions**: Use specific assertions
4. **Naming**: Descriptive test names
5. **Documentation**: Document complex test logic
6. **Cleanup**: Always clean up resources

## Maintenance

### Regular Tasks

1. Update test dependencies monthly
2. Review and update performance benchmarks
3. Add tests for new features
4. Remove obsolete tests
5. Monitor test execution time

### Test Quality Metrics

- Test coverage: `pytest --cov`
- Test execution time: `pytest --durations=10`
- Test complexity: Review cyclomatic complexity
- Test maintenance: Track test failures over time