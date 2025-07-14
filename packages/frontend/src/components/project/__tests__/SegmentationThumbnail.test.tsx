import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';
import SegmentationThumbnail from '../SegmentationThumbnail';
import apiClient from '@/lib/apiClient';
import * as svgUtils from '@/lib/svgUtils';

// Mock the API client
vi.mock('@/lib/apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

// Mock the SVG utils
vi.mock('@/lib/svgUtils', async () => {
  const actual = await vi.importActual('@/lib/svgUtils');
  return {
    ...actual,
    scalePolygons: vi.fn().mockImplementation((polygons) => polygons),
  };
});

describe('SegmentationThumbnail Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the image without segmentation when no data is available', async () => {
    // Mock API response with no polygons
    (apiClient.get as vi.Mock).mockResolvedValue({
      data: {
        polygons: [],
      },
    });

    render(
      <SegmentationThumbnail
        imageId="test-image-id"
        thumbnailUrl="https://example.com/image.jpg"
        altText="Test Image"
      />,
    );

    // Check if the image is rendered
    const image = screen.getByAltText('Test Image');
    expect(image).toBeInTheDocument();

    // Wait for API call to complete
    await act(async () => {
      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith('/api/images/test-image-id/segmentation');
      });
    });

    // No SVG should be rendered since there are no polygons
    const svg = document.querySelector('svg');
    expect(svg).not.toBeInTheDocument();
  });

  it('renders the image with segmentation overlay when data is available', async () => {
    // Mock API response with polygons
    (apiClient.get as vi.Mock).mockResolvedValue({
      data: {
        polygons: [
          {
            id: 'polygon-1',
            points: [
              { x: 10, y: 10 },
              { x: 100, y: 10 },
              { x: 100, y: 100 },
              { x: 10, y: 100 },
            ],
            type: 'external',
            color: '#ff0000',
          },
        ],
        imageWidth: 200,
        imageHeight: 200,
      },
    });

    // Mock the scalePolygons function
    (svgUtils.scalePolygons as vi.Mock).mockImplementation((polygons) => {
      return polygons.map((polygon) => ({
        ...polygon,
        points: polygon.points.map((point) => ({
          x: point.x * 1.5,
          y: point.y * 1.5,
        })),
      }));
    });

    render(
      <SegmentationThumbnail
        imageId="test-image-id"
        thumbnailUrl="https://example.com/image.jpg"
        altText="Test Image"
      />,
    );

    // Check if the image is rendered
    const image = screen.getByAltText('Test Image');
    expect(image).toBeInTheDocument();

    // Wait for API call to complete and SVG to be rendered
    await waitFor(() => {
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();

      // Check if polygon is rendered
      const polygon = document.querySelector('polygon');
      expect(polygon).toBeInTheDocument();
      expect(polygon).toHaveAttribute('fill', '#ff0000');
    });

    // Verify that scalePolygons was called
    await waitFor(() => {
      expect(svgUtils.scalePolygons).toHaveBeenCalled();
    });
  });

  it('handles image loading errors gracefully', async () => {
    // Mock API response
    (apiClient.get as vi.Mock).mockResolvedValue({
      data: {
        polygons: [],
      },
    });

    render(
      <SegmentationThumbnail
        imageId="test-image-id"
        thumbnailUrl="https://example.com/invalid-image.jpg"
        fallbackSrc="/placeholder.svg"
        altText="Test Image"
      />,
    );

    // Get the image
    const image = screen.getByAltText('Test Image');

    // Simulate an error loading the image
    image.dispatchEvent(new Event('error'));

    // Check if fallback is used
    await waitFor(() => {
      expect(image).toHaveAttribute('src', '/placeholder.svg');
    });
  });

  it('handles API errors gracefully', async () => {
    // Mock API error
    (apiClient.get as vi.Mock).mockRejectedValue(new Error('API error'));

    render(
      <SegmentationThumbnail
        imageId="test-image-id"
        thumbnailUrl="https://example.com/image.jpg"
        altText="Test Image"
      />,
    );

    // Check if the image is rendered despite API error
    const image = screen.getByAltText('Test Image');
    expect(image).toBeInTheDocument();

    // Wait for API call to complete
    await act(async () => {
      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith('/api/images/test-image-id/segmentation');
      });
    });

    // No SVG should be rendered since there was an error
    const svg = document.querySelector('svg');
    expect(svg).not.toBeInTheDocument();
  });
});
