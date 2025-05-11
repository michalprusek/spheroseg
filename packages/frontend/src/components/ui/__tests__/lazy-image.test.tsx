import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LazyImage } from '../lazy-image';
import '@testing-library/jest-dom';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/lib/urlUtils', () => ({
  constructUrl: vi.fn((url) => url), // Simply return the input URL
}));

describe('LazyImage Component', () => {
  // Mock IntersectionObserver
  const mockIntersectionObserver = vi.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  });
  window.IntersectionObserver = mockIntersectionObserver;

  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with skeleton by default', () => {
    render(<LazyImage src="/test-image.jpg" alt="Test image" />);

    // Should render a skeleton while loading
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();

    // Image should not be rendered until intersection happens
    expect(screen.queryByAltText('Test image')).not.toBeInTheDocument();
  });

  it('renders without skeleton when showSkeleton is false', () => {
    render(<LazyImage src="/test-image.jpg" alt="Test image" showSkeleton={false} />);

    // Should not render a skeleton
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
  });

  it('loads image when it enters viewport', async () => {
    // Set up a fake IntersectionObserver that triggers immediately
    mockIntersectionObserver.mockImplementationOnce((callback) => {
      callback([{ isIntersecting: true }]);
      return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      };
    });

    render(<LazyImage src="/test-image.jpg" alt="Test image" />);

    // Wait for image to be added to the DOM after intersection
    await waitFor(() => {
      expect(screen.getByAltText('Test image')).toBeInTheDocument();
    });

    // The image should have a cache busting parameter
    const img = screen.getByAltText('Test image');
    expect(img.getAttribute('src')).toContain('/test-image.jpg?_cb=');
  });

  it('handles image load event correctly', async () => {
    // Set up a fake IntersectionObserver that triggers immediately
    mockIntersectionObserver.mockImplementationOnce((callback) => {
      callback([{ isIntersecting: true }]);
      return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      };
    });

    render(<LazyImage src="/test-image.jpg" alt="Test image" />);

    // Wait for image to be added to the DOM
    await waitFor(() => {
      expect(screen.getByAltText('Test image')).toBeInTheDocument();
    });

    // Simulate image load
    fireEvent.load(screen.getByAltText('Test image'));

    // After loading, the image should be visible and skeleton should be gone
    expect(screen.getByAltText('Test image')).toHaveClass('opacity-100');
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
  });

  it('handles image error event correctly', async () => {
    // Set up a fake IntersectionObserver that triggers immediately
    mockIntersectionObserver.mockImplementationOnce((callback) => {
      callback([{ isIntersecting: true }]);
      return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      };
    });

    render(<LazyImage src="/test-image.jpg" alt="Test image" fallbackSrc="/fallback.jpg" />);

    // Wait for image to be added to the DOM
    await waitFor(() => {
      expect(screen.getByAltText('Test image')).toBeInTheDocument();
    });

    // Simulate image error
    fireEvent.error(screen.getByAltText('Test image'));

    // After error, the fallback message should be visible
    expect(screen.getByText('Failed to load image')).toBeInTheDocument();

    // The image src should be changed to fallback
    await waitFor(() => {
      expect(screen.getByAltText('Test image').getAttribute('src')).toBe('/fallback.jpg');
    });

    // The image should have grayscale class
    expect(screen.getByAltText('Test image')).toHaveClass('grayscale');
  });

  it('applies custom className and containerClassName', () => {
    render(
      <LazyImage
        src="/test-image.jpg"
        alt="Test image"
        className="custom-image-class"
        containerClassName="custom-container-class"
      />,
    );

    // Container should have custom class
    const container = screen.getByTestId('skeleton').closest('div');
    expect(container).toHaveClass('custom-container-class');
  });

  it('applies custom placeholderColor', () => {
    render(<LazyImage src="/test-image.jpg" alt="Test image" placeholderColor="#ff0000" />);

    // Container should have custom background color
    const container = screen.getByTestId('skeleton').closest('div');
    expect(container).toHaveStyle('background-color: #ff0000');
  });
});
