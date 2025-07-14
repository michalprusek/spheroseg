import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ExportOptionsCard, { AnnotationFormat, MetricsFormat } from '../ExportOptionsCard';

// Mock the useLanguage hook
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      // Simplified translation implementation
      const translations: Record<string, string> = {
        'export.title': 'Export Options',
        'export.options.includeMetadata': 'Include Metadata',
        'export.options.includeSegmentation': 'Include Segmentation',
        'export.options.includeObjectMetrics': 'Include Object Metrics',
        'export.options.includeImages': 'Include Images',
        'export.options.selectExportFormat': 'Select Export Format',
        'export.options.selectMetricsFormat': 'Select Metrics Format',
        'export.formats.COCO': 'COCO Format',
        'export.formats.YOLO': 'YOLO Format',
        'export.formats.MASK': 'Mask Format',
        'export.formats.POLYGONS': 'Polygons Format',
        'export.formatDescriptions.COCO': 'Common Objects in Context JSON format',
        'export.formatDescriptions.YOLO': 'YOLOv5 format',
        'export.formatDescriptions.MASK': 'Binary mask images',
        'export.formatDescriptions.POLYGONS': 'Raw polygon coordinates',
        'export.metricsFormats.EXCEL': 'Excel (XLSX)',
        'export.metricsFormats.CSV': 'CSV',
        'export.options.metricsFormatDescription.EXCEL': 'Microsoft Excel spreadsheet',
        'export.options.metricsFormatDescription.CSV': 'Comma-separated values',
        'export.options.exportMetricsOnly': 'Export Metrics Only',
        'export.selectImagesForExport': 'Select images for export',
        'export.metricsRequireSegmentation': 'Metrics require segmentation data',
      };
      return translations[key] || key;
    },
  }),
}));

describe('ExportOptionsCard Component', () => {
  const defaultProps = {
    includeMetadata: true,
    setIncludeMetadata: vi.fn(),
    includeSegmentation: true,
    setIncludeSegmentation: vi.fn(),
    includeObjectMetrics: true,
    setIncludeObjectMetrics: vi.fn(),
    includeImages: true,
    setIncludeImages: vi.fn(),
    annotationFormat: 'COCO' as AnnotationFormat,
    setAnnotationFormat: vi.fn(),
    metricsFormat: 'EXCEL' as MetricsFormat,
    setMetricsFormat: vi.fn(),
    handleExportMetricsAsXlsx: vi.fn(),
    getSelectedCount: vi.fn(() => 5),
    isExporting: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with all options enabled', () => {
    render(<ExportOptionsCard {...defaultProps} />);

    // Check title
    expect(screen.getByText('Export Options')).toBeInTheDocument();

    // Check checkboxes
    expect(screen.getByLabelText('Include Metadata')).toBeInTheDocument();
    expect(screen.getByLabelText('Include Segmentation')).toBeInTheDocument();
    expect(screen.getByLabelText('Include Object Metrics')).toBeInTheDocument();
    expect(screen.getByLabelText(/Include Images/)).toBeInTheDocument();

    // Check if segmentation format selector is rendered
    expect(screen.getByText('Select Export Format:')).toBeInTheDocument();

    // Check if metrics format selector is rendered
    expect(screen.getByText('Select Metrics Format:')).toBeInTheDocument();

    // Check if export metrics button is rendered
    expect(screen.getByText('Export Metrics Only')).toBeInTheDocument();
  });

  it('toggles metadata inclusion when checkbox is clicked', () => {
    render(<ExportOptionsCard {...defaultProps} />);

    const checkbox = screen.getByLabelText('Include Metadata');
    fireEvent.click(checkbox);

    expect(defaultProps.setIncludeMetadata).toHaveBeenCalledTimes(1);
    expect(defaultProps.setIncludeMetadata).toHaveBeenCalledWith(false);
  });

  it('toggles segmentation inclusion when checkbox is clicked', () => {
    render(<ExportOptionsCard {...defaultProps} />);

    const checkbox = screen.getByLabelText('Include Segmentation');
    fireEvent.click(checkbox);

    expect(defaultProps.setIncludeSegmentation).toHaveBeenCalledTimes(1);
    expect(defaultProps.setIncludeSegmentation).toHaveBeenCalledWith(false);
  });

  it('toggles object metrics inclusion when checkbox is clicked', () => {
    render(<ExportOptionsCard {...defaultProps} />);

    const checkbox = screen.getByLabelText('Include Object Metrics');
    fireEvent.click(checkbox);

    expect(defaultProps.setIncludeObjectMetrics).toHaveBeenCalledTimes(1);
    expect(defaultProps.setIncludeObjectMetrics).toHaveBeenCalledWith(false);
  });

  it('toggles images inclusion when checkbox is clicked', () => {
    render(<ExportOptionsCard {...defaultProps} />);

    const checkbox = screen.getByLabelText(/Include Images/);
    fireEvent.click(checkbox);

    expect(defaultProps.setIncludeImages).toHaveBeenCalledTimes(1);
    expect(defaultProps.setIncludeImages).toHaveBeenCalledWith(false);
  });

  it('hides annotation format selector when segmentation is not included', () => {
    render(<ExportOptionsCard {...defaultProps} includeSegmentation={false} />);

    expect(screen.queryByText('Select Export Format:')).not.toBeInTheDocument();
  });

  it('hides metrics format selector when object metrics are not included', () => {
    render(<ExportOptionsCard {...defaultProps} includeObjectMetrics={false} />);

    expect(screen.queryByText('Select Metrics Format:')).not.toBeInTheDocument();
  });

  it('disables export metrics button when there are no selected images', () => {
    render(<ExportOptionsCard {...defaultProps} getSelectedCount={() => 0} />);

    expect(screen.getByText('Export Metrics Only')).toBeDisabled();
    expect(screen.getByText('Select images for export')).toBeInTheDocument();
  });

  it('disables export metrics button when exporting is in progress', () => {
    render(<ExportOptionsCard {...defaultProps} isExporting={true} />);

    expect(screen.getByText('Export Metrics Only')).toBeDisabled();
  });

  it('calls handleExportMetricsAsXlsx when export metrics button is clicked', () => {
    render(<ExportOptionsCard {...defaultProps} />);

    const button = screen.getByText('Export Metrics Only');
    fireEvent.click(button);

    expect(defaultProps.handleExportMetricsAsXlsx).toHaveBeenCalledTimes(1);
  });

  it('displays appropriate descriptions for different annotation formats', async () => {
    const { rerender } = render(<ExportOptionsCard {...defaultProps} annotationFormat="COCO" />);

    // Initially COCO format is selected
    expect(screen.getByText('Common Objects in Context JSON format')).toBeInTheDocument();

    // Rerender with YOLO format
    rerender(<ExportOptionsCard {...defaultProps} annotationFormat="YOLO" />);
    expect(screen.getByText('YOLOv5 format')).toBeInTheDocument();

    // Rerender with MASK format
    rerender(<ExportOptionsCard {...defaultProps} annotationFormat="MASK" />);
    expect(screen.getByText('Binary mask images')).toBeInTheDocument();

    // Rerender with POLYGONS format
    rerender(<ExportOptionsCard {...defaultProps} annotationFormat="POLYGONS" />);
    expect(screen.getByText('Raw polygon coordinates')).toBeInTheDocument();
  });

  it('displays appropriate descriptions for different metrics formats', async () => {
    const { rerender } = render(<ExportOptionsCard {...defaultProps} metricsFormat="EXCEL" />);

    // Initially EXCEL format is selected
    expect(screen.getByText('Microsoft Excel spreadsheet')).toBeInTheDocument();

    // Rerender with CSV format
    rerender(<ExportOptionsCard {...defaultProps} metricsFormat="CSV" />);
    expect(screen.getByText('Comma-separated values')).toBeInTheDocument();
  });
});
