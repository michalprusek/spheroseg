import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import DebugSegmentationThumbnail from '../DebugSegmentationThumbnail';
import * as svgUtils from '@/lib/svgUtils';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as vi.Mocked<typeof axios>;

// Mock svgUtils
vi.mock('@/lib/svgUtils', () => ({
  scalePolygons: vi.fn((polygons) => polygons.map((p) => ({ ...p }))), // Simple mock that returns the same polygons
  createSvgPath: vi.fn(),
  darkenColor: vi.fn(),
}));

describe('DebugSegmentationThumbnail', () => {
  const mockProps = {
    imageId: 'test-image-id',
    projectId: 'test-project-id',
    width: 800,
    height: 600,
  };

  const mockSegmentationData = {
    polygons: [
      {
        id: 'polygon-1',
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 100 },
          { x: 200, y: 200 },
          { x: 100, y: 200 },
        ],
        type: 'external',
        class: 'spheroid',
      },
      {
        id: 'polygon-2',
        points: [
          { x: 300, y: 300 },
          { x: 400, y: 300 },
          { x: 400, y: 400 },
          { x: 300, y: 400 },
        ],
        type: 'external',
        class: 'spheroid',
      },
      {
        id: 'hole-1',
        points: [
          { x: 150, y: 150 },
          { x: 170, y: 150 },
          { x: 170, y: 170 },
          { x: 150, y: 170 },
        ],
        type: 'internal',
        class: 'hole',
      },
    ],
    imageWidth: 800,
    imageHeight: 600,
  };

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Mock console methods to reduce noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders loading state initially', () => {
    mockedAxios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<DebugSegmentationThumbnail {...mockProps} />);

    expect(screen.getByText('Loading segmentation data...')).toBeInTheDocument();
  });

  it('renders polygons when data is loaded', async () => {
    // Mock the image API response with original dimensions
    mockedAxios.get.mockImplementation((url) => {
      if (url.includes('/projects/')) {
        return Promise.resolve({
          data: {
            id: 'test-image-id',
            width: 1024,
            height: 768,
            name: 'Test Image',
          },
        });
      } else {
        return Promise.resolve({ data: mockSegmentationData });
      }
    });

    const { container } = render(<DebugSegmentationThumbnail {...mockProps} />);

    await waitFor(() => {
      // Check that we have the expected number of polygons
      const polygons = container.querySelectorAll('polygon');
      const paths = container.querySelectorAll('path');

      expect(polygons.length + paths.length).toBe(mockSegmentationData.polygons.length);
    });
  });

  it('renders error state when API call fails', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('API error'));

    render(<DebugSegmentationThumbnail {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load segmentation data')).toBeInTheDocument();
    });
  });

  it('applies correct colors based on polygon type', async () => {
    mockedAxios.get.mockImplementation((url) => {
      if (url.includes('/projects/')) {
        return Promise.resolve({
          data: {
            id: 'test-image-id',
            width: 1024,
            height: 768,
            name: 'Test Image',
          },
        });
      } else {
        return Promise.resolve({ data: mockSegmentationData });
      }
    });

    const { container } = render(<DebugSegmentationThumbnail {...mockProps} />);

    await waitFor(() => {
      const polygons = container.querySelectorAll('polygon');

      // Check that external polygons are red
      const externalPolygon = polygons[0];
      expect(externalPolygon.getAttribute('fill')).toBe('#ff0000');

      // Check that internal polygons (holes) are blue
      // Note: In our test data, the internal polygon is the third one (index 2)
      const internalPolygon = polygons[2];
      expect(internalPolygon.getAttribute('fill')).toBe('#0000ff');
    });
  });

  it('uses original image dimensions from API', async () => {
    // Mock the image API response with original dimensions
    const originalWidth = 1920;
    const originalHeight = 1080;

    // Spy on console.log to check the logged dimensions
    const consoleSpy = vi.spyOn(console, 'log');

    mockedAxios.get.mockImplementation((url) => {
      if (url.includes('/projects/')) {
        return Promise.resolve({
          data: {
            id: 'test-image-id',
            width: originalWidth,
            height: originalHeight,
            name: 'Test Image',
          },
        });
      } else {
        return Promise.resolve({ data: mockSegmentationData });
      }
    });

    render(<DebugSegmentationThumbnail {...mockProps} />);

    await waitFor(() => {
      // Check that the original dimensions were logged
      expect(consoleSpy).toHaveBeenCalledWith(
        '[DEBUG] Got original image dimensions from image API:',
        expect.objectContaining({
          width: originalWidth,
          height: originalHeight,
        }),
      );

      // Check that the final dimensions were used
      expect(consoleSpy).toHaveBeenCalledWith(
        '[DEBUG] Final segmentation data with dimensions:',
        expect.objectContaining({
          imageWidth: originalWidth,
          imageHeight: originalHeight,
        }),
      );
    });
  });
});
