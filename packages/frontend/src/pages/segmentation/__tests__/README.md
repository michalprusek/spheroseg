# SegmentationEditorV2 Tests

This directory contains comprehensive tests for the SegmentationEditorV2 component and its related functionality in the segmentation editor.

## Test Files Structure

### Basic Tests (`SegmentationEditorV2.test.tsx`)
- Basic rendering and functionality tests
- Button click handling
- Loading states
- Basic resegmentation workflow

### Enhanced Tests (`enhanced/SegmentationEditorV2.test.tsx`)
- More comprehensive tests for component behavior
- Edge cases for error handling
- URL handling when IDs differ
- Detailed zoom calculations
- Advanced resegmentation testing
- Transformation tests
- Edit mode handling

### Advanced Tests (`advanced/SegmentationEditorV2.test.tsx`)
- Focused tests on image ID resolution
- URL update behavior
- Comprehensive error handling
- Server error scenarios
- Canvas transformations
- Enhanced edit mode testing

### Keyboard Tests (`keyboard/SegmentationEditorV2KeyboardTests.tsx`)
- Keyboard shortcut handling
- Platform-specific key combinations (Mac vs Windows)
- Escape key for cancellation
- Delete key for polygon deletion
- Undo/Redo with keyboard shortcuts
- Shift key state management
- Keyboard-driven save operations

### Polygon Interaction Tests (`polygon/SegmentationEditorV2PolygonTests.tsx`)
- Polygon selection mechanics
- Vertex editing operations
- Adding new polygons
- Deleting polygons
- Slicing polygons
- Undo/Redo polygon operations
- Mouse hover behaviors
- Dragging and panning interactions

## Testing Approach

These tests follow several key testing principles:

1. **Mocking Strategy**: 
   - Canvas and toolbar components are mocked to isolate the SegmentationEditorV2 component
   - The useSegmentationV2 hook is extensively mocked with controllable state
   - API calls are mocked to test both success and error scenarios

2. **Test Organization**:
   - Tests are organized by functionality and complexity
   - Each test file focuses on a specific aspect of the component
   - Common mocking setup is reused across test files

3. **Testing Best Practices**:
   - Each test has a clear purpose and assertion
   - Tests focus on behavior rather than implementation details
   - Error scenarios and edge cases are thoroughly tested
   - Tests are designed to be maintainable and not brittle

## Code Coverage

The tests provide comprehensive coverage of:
- Component rendering
- State management
- User interactions (mouse, keyboard)
- Error handling
- API interactions
- Polygon manipulation
- Zoom and transform operations
- URL and navigation handling

## Running Tests

To run these tests, use the following command:

```bash
npm run test:frontend -- --watch --testPathPattern=segmentation
```

To run a specific test file:

```bash
npm run test:frontend -- --watch --testPathPattern=segmentation/advanced
```