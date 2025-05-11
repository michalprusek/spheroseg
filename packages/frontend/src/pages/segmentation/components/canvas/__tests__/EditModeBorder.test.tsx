import React from 'react';
import { render, screen } from '@testing-library/react';
import EditModeBorder from '../EditModeBorder';
import { describe, it, expect } from 'vitest';

describe('EditModeBorder Component', () => {
  const defaultProps = {
    editMode: false,
    slicingMode: false,
    pointAddingMode: false,
    imageSize: { width: 800, height: 600 },
    zoom: 1,
  };

  it('should not render when all modes are false', () => {
    const { container } = render(<EditModeBorder {...defaultProps} />);
    expect(container.querySelector('rect')).not.toBeInTheDocument();
  });

  it('should render a rectangle with orange border when editMode is true', () => {
    const { container } = render(<EditModeBorder {...defaultProps} editMode={true} />);

    const rect = container.querySelector('rect');
    expect(rect).toBeInTheDocument();
    expect(rect).toHaveAttribute('stroke', '#FF9500'); // Orange color
  });

  it('should render a rectangle with red border when slicingMode is true', () => {
    const { container } = render(<EditModeBorder {...defaultProps} slicingMode={true} />);

    const rect = container.querySelector('rect');
    expect(rect).toBeInTheDocument();
    expect(rect).toHaveAttribute('stroke', '#FF3B30'); // Red color
  });

  it('should render a rectangle with green border when pointAddingMode is true', () => {
    const { container } = render(<EditModeBorder {...defaultProps} pointAddingMode={true} />);

    const rect = container.querySelector('rect');
    expect(rect).toBeInTheDocument();
    expect(rect).toHaveAttribute('stroke', '#4CAF50'); // Green color
  });

  it('should prioritize slicingMode color over other modes when multiple are true', () => {
    const { container } = render(
      <EditModeBorder {...defaultProps} editMode={true} slicingMode={true} pointAddingMode={true} />,
    );

    const rect = container.querySelector('rect');
    expect(rect).toBeInTheDocument();
    expect(rect).toHaveAttribute('stroke', '#FF3B30'); // Red color (slicingMode)
  });

  it('should prioritize pointAddingMode color over editMode when both are true', () => {
    const { container } = render(<EditModeBorder {...defaultProps} editMode={true} pointAddingMode={true} />);

    const rect = container.querySelector('rect');
    expect(rect).toBeInTheDocument();
    expect(rect).toHaveAttribute('stroke', '#4CAF50'); // Green color (pointAddingMode)
  });

  it('should render a rectangle with correct dimensions based on imageSize', () => {
    const imageSize = { width: 1200, height: 800 };
    const { container } = render(<EditModeBorder {...defaultProps} editMode={true} imageSize={imageSize} />);

    const rect = container.querySelector('rect');
    expect(rect).toBeInTheDocument();
    expect(rect).toHaveAttribute('width', imageSize.width.toString());
    expect(rect).toHaveAttribute('height', imageSize.height.toString());
  });

  it('should adjust strokeWidth based on zoom level', () => {
    const zoom = 2;
    const { container } = render(<EditModeBorder {...defaultProps} editMode={true} zoom={zoom} />);

    const rect = container.querySelector('rect');
    expect(rect).toBeInTheDocument();
    expect(rect).toHaveAttribute('stroke-width', (4 / zoom).toString());
  });

  it('should adjust strokeDasharray based on zoom level', () => {
    const zoom = 2;
    const { container } = render(<EditModeBorder {...defaultProps} editMode={true} zoom={zoom} />);

    const rect = container.querySelector('rect');
    expect(rect).toBeInTheDocument();
    expect(rect).toHaveAttribute('stroke-dasharray', `${10 / zoom},${8 / zoom}`);
  });

  it('should have pointerEvents set to none to prevent interference with canvas interactions', () => {
    const { container } = render(<EditModeBorder {...defaultProps} editMode={true} />);

    const rect = container.querySelector('rect');
    expect(rect).toBeInTheDocument();
    expect(rect).toHaveAttribute('pointer-events', 'none');
  });

  it('should have vectorEffect set to non-scaling-stroke', () => {
    const { container } = render(<EditModeBorder {...defaultProps} editMode={true} />);

    const rect = container.querySelector('rect');
    expect(rect).toBeInTheDocument();
    expect(rect).toHaveAttribute('vector-effect', 'non-scaling-stroke');
  });

  it('should have a filter applied for glow effect', () => {
    const { container } = render(<EditModeBorder {...defaultProps} editMode={true} />);

    const rect = container.querySelector('rect');
    expect(rect).toBeInTheDocument();
    expect(rect).toHaveAttribute('filter', 'url(#border-glow)');
  });
});
