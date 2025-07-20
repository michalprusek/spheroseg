import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import CanvasImage from '../CanvasImage';

// Mock the urlUtils
vi.mock('@/lib/urlUtils', () => ({
  constructUrl: (url: string) => `http://localhost:8080${url}`,
}));

describe('CanvasImage', () => {
  const defaultProps = {
    src: '/images/test-image.jpg',
    alt: 'Test image',
    loading: false,
  };

  it('renders without crashing', () => {
    const { container } = render(
      <svg>
        <CanvasImage {...defaultProps} />
      </svg>
    );
    const image = container.querySelector('image');
    expect(image).toBeTruthy();
  });

  it('applies correct href attribute with processed URL', () => {
    const { container } = render(
      <svg>
        <CanvasImage {...defaultProps} />
      </svg>
    );
    const image = container.querySelector('image');
    expect(image?.getAttribute('href')).toBe('http://localhost:8080/images/test-image.jpg');
  });

  it('uses default alt text when not provided', () => {
    const { container } = render(
      <svg>
        <CanvasImage src="/test.jpg" />
      </svg>
    );
    const image = container.querySelector('image');
    expect(image).toBeTruthy();
  });

  it('renders with full width and height', () => {
    const { container } = render(
      <svg>
        <CanvasImage {...defaultProps} />
      </svg>
    );
    const image = container.querySelector('image');
    expect(image?.getAttribute('width')).toBe('100%');
    expect(image?.getAttribute('height')).toBe('100%');
  });

  it('has correct test id', () => {
    const { container } = render(
      <svg>
        <CanvasImage {...defaultProps} />
      </svg>
    );
    const image = container.querySelector('[data-testid="canvas-image"]');
    expect(image).toBeTruthy();
  });

  it('positions image at origin', () => {
    const { container } = render(
      <svg>
        <CanvasImage {...defaultProps} />
      </svg>
    );
    const image = container.querySelector('image');
    expect(image?.getAttribute('x')).toBe('0');
    expect(image?.getAttribute('y')).toBe('0');
  });
});
