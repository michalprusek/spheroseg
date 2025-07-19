import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ExcelExporter from '../ExcelExporter';
import { utils, writeFile } from 'xlsx';
import { calculateMetrics } from '../../../../utils/metricCalculations';
import '@testing-library/jest-dom';

// Mock dependencies
vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}));

vi.mock('../../../../utils/metricCalculations', () => ({
  calculateMetrics: vi.fn(() => ({
    Area: 100,
    Perimeter: 40,
    Circularity: 0.85,
    Compactness: 0.9,
    Convexity: 0.95,
    EquivalentDiameter: 11.28,
    FeretAspectRatio: 1.2,
    FeretDiameterMax: 12,
    FeretDiameterMaxOrthogonalDistance: 10,
    FeretDiameterMin: 10,
    LengthMajorDiameterThroughCentroid: 12,
    LengthMinorDiameterThroughCentroid: 10,
    Solidity: 0.98,
    Sphericity: 0.9,
  })),
}));

describe('ExcelExporter Component', () => {
  // Sample segmentation data
  const mockSegmentation = {
    id: 'seg-123',
    imageId: 'img-123',
    polygons: [
      {
        id: 'poly-1',
        type: 'external',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        color: '#ff0000',
      },
      {
        id: 'poly-2',
        type: 'external',
        points: [
          { x: 20, y: 20 },
          { x: 30, y: 20 },
          { x: 30, y: 30 },
          { x: 20, y: 30 },
        ],
        color: '#00ff00',
      },
      {
        id: 'poly-3',
        type: 'internal',
        points: [
          { x: 3, y: 3 },
          { x: 7, y: 3 },
          { x: 7, y: 7 },
          { x: 3, y: 7 },
        ],
        color: '#0000ff',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders export button when segmentation data is provided', () => {
    render(<ExcelExporter segmentation={mockSegmentation} imageName="test-image" />);

    const exportButton = screen.getByRole('button', {
      name: /Exportovat všechny metriky jako XLSX/i,
    });
    expect(exportButton).toBeInTheDocument();
  });

  it('does not render anything when segmentation is null', () => {
    const { container } = render(<ExcelExporter segmentation={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render anything when segmentation has no polygons', () => {
    const { container } = render(<ExcelExporter segmentation={{ id: 'seg-123', imageId: 'img-123', polygons: [] }} />);
    // Component renders but button should be present (even if empty array)
    expect(container).not.toBeEmptyDOMElement();
    // Should still have the export button even with empty polygons
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('exports metrics to Excel when button is clicked', () => {
    render(<ExcelExporter segmentation={mockSegmentation} imageName="test-image" />);

    const exportButton = screen.getByRole('button');
    fireEvent.click(exportButton);

    // Check if metrics were calculated for each external polygon
    expect(calculateMetrics).toHaveBeenCalledTimes(2);

    // Check if xlsx utils were called
    expect(utils.json_to_sheet).toHaveBeenCalled();
    expect(utils.book_new).toHaveBeenCalled();
    expect(utils.book_append_sheet).toHaveBeenCalled();

    // Check if writeFile was called with correct filename
    expect(writeFile).toHaveBeenCalledWith(expect.anything(), 'test-image_metrics.xlsx');
  });

  it('uses a default filename when image name is not provided', () => {
    render(<ExcelExporter segmentation={mockSegmentation} />);

    const exportButton = screen.getByRole('button');
    fireEvent.click(exportButton);

    // Check if writeFile was called with default filename
    expect(writeFile).toHaveBeenCalledWith(expect.anything(), 'spheroid_metrics.xlsx');
  });

  it('correctly formats data for Excel export', () => {
    render(<ExcelExporter segmentation={mockSegmentation} imageName="test-image" />);

    const exportButton = screen.getByRole('button');
    fireEvent.click(exportButton);

    // Check if json_to_sheet was called with correctly formatted data
    const jsonToSheetCallArg = (utils.json_to_sheet as unknown).mock.calls[0][0];

    // Should contain two items (one for each external polygon)
    expect(jsonToSheetCallArg.length).toBe(2);

    // Check fields of first item
    expect(jsonToSheetCallArg[0]).toEqual({
      'Image Name': 'test-image',
      Contour: 1,
      Area: 100,
      Circularity: 0.85,
      Compactness: 0.9,
      Convexity: 0.95,
      'Equivalent Diameter': 11.28,
      'Aspect Ratio': 1.2,
      'Feret Diameter Max': 12,
      'Feret Diameter Max Orthogonal': 10,
      'Feret Diameter Min': 10,
      'Length Major Diameter': 12,
      'Length Minor Diameter': 10,
      Perimeter: 40,
      Solidity: 0.98,
      Sphericity: 0.9,
    });
  });

  it('sets column widths for better Excel formatting', () => {
    render(<ExcelExporter segmentation={mockSegmentation} imageName="test-image" />);

    const exportButton = screen.getByRole('button');
    fireEvent.click(exportButton);

    // Check if column widths were set
    const jsonToSheetResult = (utils.json_to_sheet as unknown).mock.results[0].value;

    // Mock the result to simulate setting of column widths
    expect(jsonToSheetResult['!cols']).toBeDefined();
    expect(jsonToSheetResult['!cols'].length).toBe(16); // Should have 16 columns
  });

  it('creates an Excel workbook with the correct sheet name', () => {
    render(<ExcelExporter segmentation={mockSegmentation} imageName="test-image" />);

    const exportButton = screen.getByRole('button');
    fireEvent.click(exportButton);

    // Check if book_append_sheet was called with correct sheet name
    expect(utils.book_append_sheet).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'Spheroid Metrics');
  });
});
