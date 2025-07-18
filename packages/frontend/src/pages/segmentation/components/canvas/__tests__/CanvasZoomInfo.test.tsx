import { render, screen } from '@testing-library/react';
import CanvasZoomInfo from '../CanvasZoomInfo';
import '@testing-library/jest-dom';

describe('CanvasZoomInfo Component', () => {
  it('renders with default zoom value', () => {
    render(<CanvasZoomInfo zoom={1} />);

    const zoomInfo = screen.getByText('100%');
    expect(zoomInfo).toBeInTheDocument();
  });

  it('renders with custom zoom value', () => {
    render(<CanvasZoomInfo zoom={2.5} />);

    const zoomInfo = screen.getByText('250%');
    expect(zoomInfo).toBeInTheDocument();
  });

  it('renders with fractional zoom value', () => {
    render(<CanvasZoomInfo zoom={0.75} />);

    const zoomInfo = screen.getByText('75%');
    expect(zoomInfo).toBeInTheDocument();
  });

  it('renders with very small zoom value', () => {
    render(<CanvasZoomInfo zoom={0.1} />);

    const zoomInfo = screen.getByText('10%');
    expect(zoomInfo).toBeInTheDocument();
  });

  it('renders with very large zoom value', () => {
    render(<CanvasZoomInfo zoom={10} />);

    const zoomInfo = screen.getByText('1000%');
    expect(zoomInfo).toBeInTheDocument();
  });

  it('has the correct text content', () => {
    render(<CanvasZoomInfo zoom={1} />);

    const zoomInfo = screen.getByText('100%');
    expect(zoomInfo).toBeInTheDocument();
  });
});
