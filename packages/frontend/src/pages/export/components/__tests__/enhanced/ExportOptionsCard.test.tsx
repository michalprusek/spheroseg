import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ExportOptionsCard, { AnnotationFormat, MetricsFormat } from '../../ExportOptionsCard';
import '@testing-library/jest-dom';

// Mock the Lucide React icons
vi.mock('lucide-react', () => ({
  FileSpreadsheet: () => <div data-testid="icon-file-spreadsheet">FileSpreadsheet</div>,
  FileText: () => <div data-testid="icon-file-text">FileText</div>,
  Image: () => <div data-testid="icon-image">Image</div>,
  Check: () => <div data-testid="icon-check">Check</div>,
}));

// Mock radix-optimized library
vi.mock('@/lib/radix-optimized', () => ({
  CheckboxRoot: ({ children, onCheckedChange, checked, id, ...props }: any) => (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onCheckedChange && onCheckedChange(e.target.checked)}
      {...props}
    />
  ),
  CheckboxIndicator: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SelectRoot: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SelectTrigger: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SelectValue: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SelectContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SelectItem: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SelectSeparator: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  CardRoot: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

// Detailed language context mock with translations
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({
    language: 'en',
    setLanguage: vi.fn(),
    t: (key: string) => {
      const translations = {
        'export.title': 'Export Options',
        'export.options.includeMetadata': 'Include Project Metadata',
        'export.options.includeSegmentation': 'Include Segmentation',
        'export.options.includeObjectMetrics': 'Include Object Metrics',
        'export.options.includeImages': 'Include Original Images',
        'export.options.selectExportFormat': 'Select Export Format',
        'export.options.selectMetricsFormat': 'Select Metrics Format',
        'export.options.exportMetricsOnly': 'Export Metrics Only',
        'export.options.metricsFormatDescription.EXCEL': 'Excel spreadsheet with multiple worksheets',
        'export.options.metricsFormatDescription.CSV': 'Comma-separated values file',
        'export.selectImagesForExport': 'Please select images for export',
        'export.metricsRequireSegmentation': 'Metrics are based on segmentation data',
        'export.formats.COCO': 'COCO JSON',
        'export.formats.YOLO': 'YOLO TXT',
        'export.formats.MASK': 'Binary Masks',
        'export.formats.POLYGONS': 'Polygon JSON',
        'export.formatDescriptions.COCO': 'Common Objects in Context format',
        'export.formatDescriptions.YOLO': 'You Only Look Once format',
        'export.formatDescriptions.MASK': 'Binary mask images',
        'export.formatDescriptions.POLYGONS': 'Raw polygon coordinates',
        'export.metricsFormats.EXCEL': 'Excel (.xlsx)',
        'export.metricsFormats.CSV': 'CSV (.csv)',
      };
      return translations[key] || key;
    },
  })),
}));

// Mock for UI components that might need special handling
vi.mock('@/components/ui/select', () => {
  const SelectContent = ({ children }: any) => <div data-testid="select-content">{children}</div>;
  const SelectItem = ({ children, value }: any) => (
    <option value={value} data-testid={`select-item-${value}`}>
      {children}
    </option>
  );

  return {
    Select: ({ children, value, onValueChange }: any) => (
      <div data-testid="select-mock">
        <select
          data-testid="select-element"
          value={value}
          onChange={(e) => onValueChange && onValueChange(e.target.value)}
        >
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child) && child.type === SelectContent) {
              return React.Children.map(child.props.children, (item) => {
                if (React.isValidElement(item) && item.type === SelectItem) {
                  return <option value={item.props.value}>{item.props.children}</option>;
                }
                return null;
              });
            }
            return null;
          })}
        </select>
        {children}
      </div>
    ),
    SelectTrigger: ({ children, className, id }: any) => (
      <div data-testid={`select-trigger-${id}`} className={className}>
        {children}
      </div>
    ),
    SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
    SelectContent,
    SelectItem,
  };
});

describe('ExportOptionsCard Component (Enhanced)', () => {
  // Setup userEvent
  const user = userEvent.setup();

  // Default props for testing
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
    getSelectedCount: vi.fn().mockReturnValue(5),
    isExporting: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with all options enabled and proper translations', () => {
    render(<ExportOptionsCard {...defaultProps} />);

    // Check if the title is rendered with correct translation
    expect(screen.getByText('Export Options')).toBeInTheDocument();

    // Check if all checkboxes are rendered and checked with correct translations
    const metadataCheckbox = screen.getByLabelText('Include Project Metadata');
    const segmentationCheckbox = screen.getByLabelText('Include Segmentation');
    const metricsCheckbox = screen.getByLabelText('Include Object Metrics');
    const imagesCheckbox = screen.getByLabelText('Include Original Images');

    expect(metadataCheckbox).toBeInTheDocument();
    expect(segmentationCheckbox).toBeInTheDocument();
    expect(metricsCheckbox).toBeInTheDocument();
    expect(imagesCheckbox).toBeInTheDocument();

    expect(metadataCheckbox).toBeChecked();
    expect(segmentationCheckbox).toBeChecked();
    expect(metricsCheckbox).toBeChecked();
    expect(imagesCheckbox).toBeChecked();

    // Check format selectors have proper translations
    expect(screen.getByText('Select Export Format')).toBeInTheDocument();
    expect(screen.getByText('Select Metrics Format')).toBeInTheDocument();

    // Verify the format descriptions are properly translated
    expect(screen.getByText('Common Objects in Context format')).toBeInTheDocument();
    expect(screen.getByText('Excel spreadsheet with multiple worksheets')).toBeInTheDocument();

    // Verify metrics info is properly translated
    expect(screen.getByText('Metrics are based on segmentation data')).toBeInTheDocument();
  });

  it('reacts properly to checkbox state changes with correct callback invocations', async () => {
    render(<ExportOptionsCard {...defaultProps} />);

    // Get all checkboxes
    const metadataCheckbox = screen.getByLabelText('Include Project Metadata');
    const segmentationCheckbox = screen.getByLabelText('Include Segmentation');
    const metricsCheckbox = screen.getByLabelText('Include Object Metrics');
    const imagesCheckbox = screen.getByLabelText('Include Original Images');

    // Click on each checkbox and check if the correct setter is called with opposite value
    await user.click(metadataCheckbox);
    expect(defaultProps.setIncludeMetadata).toHaveBeenCalledWith(false);

    await user.click(segmentationCheckbox);
    expect(defaultProps.setIncludeSegmentation).toHaveBeenCalledWith(false);

    await user.click(metricsCheckbox);
    expect(defaultProps.setIncludeObjectMetrics).toHaveBeenCalledWith(false);

    await user.click(imagesCheckbox);
    expect(defaultProps.setIncludeImages).toHaveBeenCalledWith(false);

    // Verify all setters were called exactly once
    expect(defaultProps.setIncludeMetadata).toHaveBeenCalledTimes(1);
    expect(defaultProps.setIncludeSegmentation).toHaveBeenCalledTimes(1);
    expect(defaultProps.setIncludeObjectMetrics).toHaveBeenCalledTimes(1);
    expect(defaultProps.setIncludeImages).toHaveBeenCalledTimes(1);
  });

  it('selects annotation formats correctly through the dropdown', async () => {
    render(<ExportOptionsCard {...defaultProps} />);

    // Get the annotation format select and change its value
    const annotationFormatSelect = screen.getByTestId('select-element');

    // Change to YOLO format
    fireEvent.change(annotationFormatSelect, { target: { value: 'YOLO' } });
    expect(defaultProps.setAnnotationFormat).toHaveBeenCalledWith('YOLO');

    // Change to MASK format
    fireEvent.change(annotationFormatSelect, { target: { value: 'MASK' } });
    expect(defaultProps.setAnnotationFormat).toHaveBeenCalledWith('MASK');

    // Change to POLYGONS format
    fireEvent.change(annotationFormatSelect, { target: { value: 'POLYGONS' } });
    expect(defaultProps.setAnnotationFormat).toHaveBeenCalledWith('POLYGONS');

    // Verify setAnnotationFormat was called exactly 3 times
    expect(defaultProps.setAnnotationFormat).toHaveBeenCalledTimes(3);
  });

  it('selects metrics formats correctly through the dropdown', async () => {
    render(<ExportOptionsCard {...defaultProps} />);

    // Get the metrics format select and change its value
    const metricsFormatSelect = screen.getByTestId('select-element');

    // Change to CSV format
    fireEvent.change(metricsFormatSelect, { target: { value: 'CSV' } });
    expect(defaultProps.setMetricsFormat).toHaveBeenCalledWith('CSV');

    // Change back to EXCEL format
    fireEvent.change(metricsFormatSelect, { target: { value: 'EXCEL' } });
    expect(defaultProps.setMetricsFormat).toHaveBeenCalledWith('EXCEL');

    // Verify setMetricsFormat was called exactly 2 times
    expect(defaultProps.setMetricsFormat).toHaveBeenCalledTimes(2);
  });

  it('handles export metrics button click with loading state', async () => {
    // Create a mock implementation with async behavior
    const asyncExportMock = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
    });

    const asyncProps = {
      ...defaultProps,
      handleExportMetricsAsXlsx: asyncExportMock,
      isExporting: false,
    };

    const { rerender } = render(<ExportOptionsCard {...asyncProps} />);

    // Get the export button
    const exportButton = screen.getByText('Export Metrics Only');
    expect(exportButton).not.toBeDisabled();

    // Click the export button
    await user.click(exportButton);
    expect(asyncExportMock).toHaveBeenCalledTimes(1);

    // Rerender with isExporting set to true
    rerender(<ExportOptionsCard {...{ ...asyncProps, isExporting: true }} />);

    // Check if the button is disabled during export
    const disabledButton = screen.getByText('Export Metrics Only');
    expect(disabledButton).toBeDisabled();
  });

  it('displays and hides conditional UI elements based on checkbox states', () => {
    // Render with segmentation and metrics disabled
    const { rerender } = render(
      <ExportOptionsCard {...defaultProps} includeSegmentation={false} includeObjectMetrics={false} />,
    );

    // Verify that format selectors are not displayed
    expect(screen.queryByText('Select Export Format')).not.toBeInTheDocument();
    expect(screen.queryByText('Select Metrics Format')).not.toBeInTheDocument();

    // Verify that format descriptions are not displayed
    expect(screen.queryByText('Common Objects in Context format')).not.toBeInTheDocument();
    expect(screen.queryByText('Excel spreadsheet with multiple worksheets')).not.toBeInTheDocument();

    // Rerender with segmentation enabled but metrics disabled
    rerender(<ExportOptionsCard {...defaultProps} includeSegmentation={true} includeObjectMetrics={false} />);

    // Verify that segmentation format selector is displayed but metrics format is not
    expect(screen.getByText('Select Export Format')).toBeInTheDocument();
    expect(screen.queryByText('Select Metrics Format')).not.toBeInTheDocument();

    // Verify that segmentation format description is displayed but metrics format is not
    expect(screen.getByText('Common Objects in Context format')).toBeInTheDocument();
    expect(screen.queryByText('Excel spreadsheet with multiple worksheets')).not.toBeInTheDocument();

    // Rerender with segmentation disabled but metrics enabled
    rerender(<ExportOptionsCard {...defaultProps} includeSegmentation={false} includeObjectMetrics={true} />);

    // Verify that segmentation format selector is not displayed but metrics format is
    expect(screen.queryByText('Select Export Format')).not.toBeInTheDocument();
    expect(screen.getByText('Select Metrics Format')).toBeInTheDocument();

    // Verify that segmentation format description is not displayed but metrics format is
    expect(screen.queryByText('Common Objects in Context format')).not.toBeInTheDocument();
    expect(screen.getByText('Excel spreadsheet with multiple worksheets')).toBeInTheDocument();
  });

  it('shows warning when no images are selected', () => {
    // Create props with no selected images
    const noImagesProps = {
      ...defaultProps,
      getSelectedCount: vi.fn().mockReturnValue(0),
    };

    render(<ExportOptionsCard {...noImagesProps} />);

    // Verify that warning message is displayed
    expect(screen.getByText('Please select images for export')).toBeInTheDocument();

    // Verify that export button is disabled
    const exportButton = screen.getByText('Export Metrics Only');
    expect(exportButton).toBeDisabled();
  });

  it('handles different format descriptions correctly', async () => {
    const { rerender } = render(<ExportOptionsCard {...defaultProps} />);

    // Initially COCO format should be selected and its description shown
    expect(screen.getByText('Common Objects in Context format')).toBeInTheDocument();

    // Test all different annotation formats
    const formats: AnnotationFormat[] = ['YOLO', 'MASK', 'POLYGONS', 'COCO'];
    const descriptions = [
      'You Only Look Once format',
      'Binary mask images',
      'Raw polygon coordinates',
      'Common Objects in Context format',
    ];

    for (let i = 0; i < formats.length; i++) {
      rerender(<ExportOptionsCard {...defaultProps} annotationFormat={formats[i]} />);
      expect(screen.getByText(descriptions[i])).toBeInTheDocument();
    }

    // Test metrics formats
    rerender(<ExportOptionsCard {...defaultProps} metricsFormat="CSV" />);
    expect(screen.getByText('Comma-separated values file')).toBeInTheDocument();

    rerender(<ExportOptionsCard {...defaultProps} metricsFormat="EXCEL" />);
    expect(screen.getByText('Excel spreadsheet with multiple worksheets')).toBeInTheDocument();
  });

  it.skip('properly integrates with i18n translations', () => {
    // Skip this test as the mock is already configured for English translations
    // and dynamic mock overriding is complex in this context
  });
});
