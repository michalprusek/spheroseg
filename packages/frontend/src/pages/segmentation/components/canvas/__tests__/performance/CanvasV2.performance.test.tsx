import { describe, expect, it } from 'vitest';
import { CanvasV2 } from '../../../canvas/CanvasV2';
import { testRenderPerformance } from '../../../../../../__tests__/performance/performanceTest';
import { EditMode } from '../../hooks/segmentation/types';
import { createRandomPolygons, createMockImageData } from '../../../../../../__tests__/fixtures/polygonFixtures';

describe('CanvasV2 Performance Tests', () => {
  // Create mock image data
  const mockImageData = createMockImageData();

  it('should render empty canvas efficiently', async () => {
    // Test with empty canvas
    const result = await testRenderPerformance(
      <CanvasV2
        imageData={mockImageData}
        polygons={[]}
        editMode={EditMode.VIEW}
        selectedPolygonIndex={-1}
        scale={1}
        panOffset={{ x: 0, y: 0 }}
        onPolygonSelect={() => {}}
        onPolygonsChange={() => {}}
        onScaleChange={() => {}}
        onPanChange={() => {}}
      />,
      {
        iterations: 50,
        maxRenderTime: 20, // Allow slightly longer render time than 16.67ms
        verbose: true,
      },
    );

    expect(result.passes).toBe(true);
  });

  it('should render with few polygons efficiently', async () => {
    // Test with 10 polygons
    const fewPolygons = createRandomPolygons(10);

    const result = await testRenderPerformance(
      <CanvasV2
        imageData={mockImageData}
        polygons={fewPolygons}
        editMode={EditMode.VIEW}
        selectedPolygonIndex={-1}
        scale={1}
        panOffset={{ x: 0, y: 0 }}
        onPolygonSelect={() => {}}
        onPolygonsChange={() => {}}
        onScaleChange={() => {}}
        onPanChange={() => {}}
      />,
      {
        iterations: 50,
        maxRenderTime: 25, // Allow more time for rendering polygons
        verbose: true,
      },
    );

    expect(result.passes).toBe(true);
  });

  it('should manage moderate polygon count with acceptable performance', async () => {
    // Test with 50 polygons
    const moderatePolygons = createRandomPolygons(50);

    const result = await testRenderPerformance(
      <CanvasV2
        imageData={mockImageData}
        polygons={moderatePolygons}
        editMode={EditMode.VIEW}
        selectedPolygonIndex={-1}
        scale={1}
        panOffset={{ x: 0, y: 0 }}
        onPolygonSelect={() => {}}
        onPolygonsChange={() => {}}
        onScaleChange={() => {}}
        onPanChange={() => {}}
      />,
      {
        iterations: 30, // Reduce iterations for heavier test
        maxRenderTime: 30, // More lenient for moderate load
        verbose: true,
      },
    );

    expect(result.passes).toBe(true);
  });

  it('should handle high polygon count (stress test)', async () => {
    // Test with 200 polygons - this is a stress test
    const manyPolygons = createRandomPolygons(200);

    const result = await testRenderPerformance(
      <CanvasV2
        imageData={mockImageData}
        polygons={manyPolygons}
        editMode={EditMode.VIEW}
        selectedPolygonIndex={-1}
        scale={1}
        panOffset={{ x: 0, y: 0 }}
        onPolygonSelect={() => {}}
        onPolygonsChange={() => {}}
        onScaleChange={() => {}}
        onPanChange={() => {}}
      />,
      {
        iterations: 20, // Reduce iterations for heavy test
        maxRenderTime: 50, // Much more lenient for stress test
        verbose: true,
      },
    );

    // This is informational, we don't necessarily expect it to pass
    // but we want to know how it performs under heavy load
    console.log(`Canvas stress test with 200 polygons: ${result.passes ? 'PASS' : 'FAIL'}`);
    console.log(`Average render time: ${result.averageRenderTime.toFixed(2)}ms`);
  });

  it('should render efficiently in different edit modes', async () => {
    // Test with 20 polygons in different edit modes
    const polygons = createRandomPolygons(20);

    // Test VIEW mode
    const viewModeResult = await testRenderPerformance(
      <CanvasV2
        imageData={mockImageData}
        polygons={polygons}
        editMode={EditMode.VIEW}
        selectedPolygonIndex={-1}
        scale={1}
        panOffset={{ x: 0, y: 0 }}
        onPolygonSelect={() => {}}
        onPolygonsChange={() => {}}
        onScaleChange={() => {}}
        onPanChange={() => {}}
      />,
      { iterations: 30, verbose: true },
    );

    // Test EDIT mode
    const editModeResult = await testRenderPerformance(
      <CanvasV2
        imageData={mockImageData}
        polygons={polygons}
        editMode={EditMode.EDIT}
        selectedPolygonIndex={0}
        scale={1}
        panOffset={{ x: 0, y: 0 }}
        onPolygonSelect={() => {}}
        onPolygonsChange={() => {}}
        onScaleChange={() => {}}
        onPanChange={() => {}}
      />,
      { iterations: 30, verbose: true },
    );

    // Test CREATE mode
    const createModeResult = await testRenderPerformance(
      <CanvasV2
        imageData={mockImageData}
        polygons={polygons}
        editMode={EditMode.CREATE}
        selectedPolygonIndex={-1}
        scale={1}
        panOffset={{ x: 0, y: 0 }}
        onPolygonSelect={() => {}}
        onPolygonsChange={() => {}}
        onScaleChange={() => {}}
        onPanChange={() => {}}
      />,
      { iterations: 30, verbose: true },
    );

    // We expect EDIT mode to be slightly slower than VIEW mode due to
    // additional handlers and UI elements for editing
    console.log('\nPerformance comparison across edit modes:');
    console.log(`VIEW mode: ${viewModeResult.averageRenderTime.toFixed(2)}ms`);
    console.log(`EDIT mode: ${editModeResult.averageRenderTime.toFixed(2)}ms`);
    console.log(`CREATE mode: ${createModeResult.averageRenderTime.toFixed(2)}ms`);
  });
});
