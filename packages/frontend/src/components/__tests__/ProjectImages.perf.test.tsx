/**
 * Performance tests for ProjectImages component
 * Validates virtual scrolling implementation
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProjectImages from '../project/ProjectImages';
import { ProjectImage } from '@spheroseg/types';

// Mock react-window
jest.mock('react-window', () => ({
  FixedSizeGrid: ({ children, columnCount, rowCount, overscanRowCount }: any) => {
    // Simulate virtual scrolling - only render visible items
    const visibleRows = 2; // Simulate 2 visible rows
    const items = [];
    for (let row = 0; row < Math.min(rowCount, visibleRows); row++) {
      for (let col = 0; col < columnCount; col++) {
        const index = row * columnCount + col;
        items.push(
          <div key={`${row}-${col}`} data-testid={`grid-item-${index}`}>
            {children({ columnIndex: col, rowIndex: row, style: {} })}
          </div>,
        );
      }
    }
    return (
      <div data-testid="virtual-grid" data-overscan={overscanRowCount}>
        {items}
      </div>
    );
  },
  VariableSizeList: ({ children, itemCount, overscanCount }: any) => {
    // Simulate virtual scrolling - only render visible items
    const visibleItems = 5; // Simulate 5 visible items
    const items = [];
    for (let i = 0; i < Math.min(itemCount, visibleItems); i++) {
      items.push(
        <div key={i} data-testid={`list-item-${i}`}>
          {children({ index: i, style: {} })}
        </div>,
      );
    }
    return (
      <div data-testid="virtual-list" data-overscan={overscanCount}>
        {items}
      </div>
    );
  },
}));

// Mock other dependencies
jest.mock('../project/ImageDisplay', () => ({
  ImageDisplay: ({ image }: { image: ProjectImage }) => <div data-testid={`image-${image.id}`}>{image.filename}</div>,
}));

describe('ProjectImages Performance Tests', () => {
  const createMockImages = (count: number): ProjectImage[] => {
    return Array.from(
      { length: count },
      (_, i) =>
        ({
          id: `image-${i}`,
          filename: `test-${i}.jpg`,
          filepath: `/uploads/test-${i}.jpg`,
          thumbnailPath: `/thumbnails/test-${i}.jpg`,
          projectId: 'project-1',
          segmentationStatus: 'completed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }) as ProjectImage,
    );
  };

  const defaultProps = {
    images: [],
    onDelete: jest.fn(),
    onOpen: jest.fn(),
    onResegment: jest.fn(),
    viewMode: 'grid' as const,
  };

  describe('Virtual Scrolling Performance', () => {
    it('should only render visible items in grid view with large datasets', () => {
      const largeImageSet = createMockImages(1000);
      const { container } = render(<ProjectImages {...defaultProps} images={largeImageSet} viewMode="grid" />);

      // Verify virtual grid is used
      const virtualGrid = screen.getByTestId('virtual-grid');
      expect(virtualGrid).toBeInTheDocument();

      // Only a small subset of items should be rendered (not all 1000)
      // With 4 columns and 2 visible rows = 8 items max
      const renderedItems = container.querySelectorAll('[data-testid^="image-"]');
      expect(renderedItems.length).toBeLessThanOrEqual(8);
      expect(renderedItems.length).toBeGreaterThan(0);
    });

    it('should only render visible items in list view with large datasets', () => {
      const largeImageSet = createMockImages(500);
      const { container } = render(<ProjectImages {...defaultProps} images={largeImageSet} viewMode="list" />);

      // Verify virtual list is used
      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList).toBeInTheDocument();

      // Only visible items should be rendered (not all 500)
      const renderedItems = container.querySelectorAll('[data-testid^="image-"]');
      expect(renderedItems.length).toBeLessThanOrEqual(5); // Based on mock
      expect(renderedItems.length).toBeGreaterThan(0);
    });

    it('should configure overscan for smooth scrolling', () => {
      const images = createMockImages(100);
      render(<ProjectImages {...defaultProps} images={images} viewMode="grid" />);

      const virtualGrid = screen.getByTestId('virtual-grid');
      expect(virtualGrid).toHaveAttribute('data-overscan', '2');
    });

    it('should handle empty image list efficiently', () => {
      const { container } = render(<ProjectImages {...defaultProps} images={[]} viewMode="grid" />);

      // Should still create virtual grid structure
      const virtualGrid = screen.getByTestId('virtual-grid');
      expect(virtualGrid).toBeInTheDocument();

      // But no items should be rendered
      const renderedItems = container.querySelectorAll('[data-testid^="image-"]');
      expect(renderedItems.length).toBe(0);
    });

    it('should maintain performance with selection mode enabled', () => {
      const largeImageSet = createMockImages(1000);
      const selectedImages = { 'image-0': true, 'image-1': true };

      const { container } = render(
        <ProjectImages
          {...defaultProps}
          images={largeImageSet}
          viewMode="grid"
          selectionMode={true}
          selectedImages={selectedImages}
          onToggleSelection={jest.fn()}
        />,
      );

      // Should still use virtual scrolling
      const virtualGrid = screen.getByTestId('virtual-grid');
      expect(virtualGrid).toBeInTheDocument();

      // Only visible items rendered despite selection state
      const renderedItems = container.querySelectorAll('[data-testid^="image-"]');
      expect(renderedItems.length).toBeLessThanOrEqual(8);
    });
  });

  describe('Memory Efficiency', () => {
    it('should handle 10,000 images without rendering all DOM nodes', () => {
      const hugeImageSet = createMockImages(10000);

      const startTime = Date.now();
      const { container } = render(<ProjectImages {...defaultProps} images={hugeImageSet} viewMode="grid" />);
      const renderTime = Date.now() - startTime;

      // Render time should be fast even with 10k images
      expect(renderTime).toBeLessThan(100); // Should render in under 100ms

      // Only visible subset should be in DOM
      const renderedItems = container.querySelectorAll('[data-testid^="image-"]');
      expect(renderedItems.length).toBeLessThan(20); // Much less than 10,000
    });
  });
});
