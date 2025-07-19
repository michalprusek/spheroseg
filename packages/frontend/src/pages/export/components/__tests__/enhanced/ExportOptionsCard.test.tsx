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

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div data-testid="card" {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div data-testid="card-header" {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 data-testid="card-title" {...props}>{children}</h3>,
  CardContent: ({ children, ...props }: any) => <div data-testid="card-content" {...props}>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button data-testid="button" {...props}>{children}</button>,
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ onCheckedChange, checked, id, ...props }: any) => (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onCheckedChange && onCheckedChange(e.target.checked)}
      data-testid={`checkbox-${id}`}
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor, ...props }: any) => (
    <label htmlFor={htmlFor} data-testid={`label-${htmlFor}`} {...props}>
      {children}
    </label>
  ),
}));

// Mock select components with proper behavior
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => {
    const [internalValue, setInternalValue] = React.useState(value);
    
    React.useEffect(() => {
      setInternalValue(value);
    }, [value]);

    const handleChange = (newValue: string) => {
      setInternalValue(newValue);
      if (onValueChange) {
        onValueChange(newValue);
      }
    };

    return (
      <div data-testid="select-root" data-value={internalValue}>
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<any>, {
              value: internalValue,
              onValueChange: handleChange,
            });
          }
          return child;
        })}
      </div>
    );
  },
  SelectTrigger: ({ children, value }: any) => (
    <button data-testid="select-trigger" data-value={value}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder, ...props }: any) => {
    const parent = props.value || placeholder;
    return <span data-testid="select-value">{parent}</span>;
  },
  SelectContent: ({ children, onValueChange, value }: any) => (
    <div data-testid="select-content">
      <select 
        data-testid="select-native"
        value={value}
        onChange={(e) => onValueChange && onValueChange(e.target.value)}
      >
        {React.Children.map(children, child => {
          if (React.isValidElement(child) && child.props.value) {
            return (
              <option key={child.props.value} value={child.props.value}>
                {child.props.children}
              </option>
            );
          }
          return null;
        })}
      </select>
    </div>
  ),
  SelectItem: ({ children, value }: any) => (
    <div data-testid={`select-item-${value}`} data-value={value}>
      {children}
    </div>
  ),
}));

// Mock language context with translations
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({
    language: 'en',
    setLanguage: vi.fn(),
    t: (key: string) => {
      const translations: Record<string, string> = {
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

describe('ExportOptionsCard Component (Enhanced)', () => {
  const mockProps = {
    includeMetadata: false,
    setIncludeMetadata: vi.fn(),
    includeSegmentation: false,
    setIncludeSegmentation: vi.fn(),
    includeObjectMetrics: false,
    setIncludeObjectMetrics: vi.fn(),
    includeImages: false,
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

  it('renders correctly with all options enabled and proper translations', () => {
    const { container } = render(<ExportOptionsCard {...mockProps} />);
    
    // Check title
    expect(screen.getByText('Export Options')).toBeInTheDocument();
    
    // Check all checkboxes are rendered with labels
    expect(screen.getByText('Include Project Metadata')).toBeInTheDocument();
    expect(screen.getByText('Include Segmentation')).toBeInTheDocument();
    expect(screen.getByText('Include Object Metrics')).toBeInTheDocument();
    expect(screen.getByText('Include Original Images')).toBeInTheDocument();
    
    // Check format selectors
    expect(screen.getByText('Select Export Format')).toBeInTheDocument();
    expect(screen.getByText('Select Metrics Format')).toBeInTheDocument();
    
    // Check export button
    expect(screen.getByText('Export Metrics Only')).toBeInTheDocument();
  });

  it('reacts properly to checkbox state changes with correct callback invocations', async () => {
    render(<ExportOptionsCard {...mockProps} />);
    const user = userEvent.setup();
    
    // Find checkboxes
    const metadataCheckbox = screen.getByTestId('checkbox-include-metadata');
    const segmentationCheckbox = screen.getByTestId('checkbox-include-segmentation');
    const metricsCheckbox = screen.getByTestId('checkbox-include-metrics');
    const imagesCheckbox = screen.getByTestId('checkbox-include-images');
    
    // Click each checkbox
    await user.click(metadataCheckbox);
    expect(mockProps.setIncludeMetadata).toHaveBeenCalledWith(true);
    
    await user.click(segmentationCheckbox);
    expect(mockProps.setIncludeSegmentation).toHaveBeenCalledWith(true);
    
    await user.click(metricsCheckbox);
    expect(mockProps.setIncludeObjectMetrics).toHaveBeenCalledWith(true);
    
    await user.click(imagesCheckbox);
    expect(mockProps.setIncludeImages).toHaveBeenCalledWith(true);
  });

  it('selects annotation formats correctly through the dropdown', async () => {
    render(<ExportOptionsCard {...mockProps} includeSegmentation={true} />);
    
    // Find the annotation format select
    const annotationSelect = screen.getAllByTestId('select-native')[0];
    
    // Change the value
    fireEvent.change(annotationSelect, { target: { value: 'YOLO' } });
    
    expect(mockProps.setAnnotationFormat).toHaveBeenCalledWith('YOLO');
  });

  it('selects metrics formats correctly through the dropdown', async () => {
    render(<ExportOptionsCard {...mockProps} includeObjectMetrics={true} />);
    
    // Find the metrics format select (should be the second one)
    const selects = screen.getAllByTestId('select-native');
    const metricsSelect = selects[selects.length - 1];
    
    // Change the value
    fireEvent.change(metricsSelect, { target: { value: 'CSV' } });
    
    expect(mockProps.setMetricsFormat).toHaveBeenCalledWith('CSV');
  });

  it('handles export metrics button click with loading state', async () => {
    const { rerender } = render(<ExportOptionsCard {...mockProps} />);
    const user = userEvent.setup();
    
    const exportButton = screen.getByText('Export Metrics Only');
    
    // Button should be enabled initially
    expect(exportButton).not.toBeDisabled();
    
    // Click the button
    await user.click(exportButton);
    expect(mockProps.handleExportMetricsAsXlsx).toHaveBeenCalled();
    
    // Rerender with loading state
    rerender(<ExportOptionsCard {...mockProps} isExporting={true} />);
    
    // Button should be disabled when exporting
    const disabledButton = screen.getByText('Export Metrics Only');
    expect(disabledButton).toBeDisabled();
  });

  it('displays and hides conditional UI elements based on checkbox states', () => {
    const { rerender } = render(<ExportOptionsCard {...mockProps} />);
    
    // Initially, format selectors should not be visible
    expect(screen.queryAllByTestId('select-native')).toHaveLength(0);
    
    // Enable segmentation - annotation format selector should appear
    rerender(<ExportOptionsCard {...mockProps} includeSegmentation={true} />);
    expect(screen.queryAllByTestId('select-native')).toHaveLength(1);
    
    // Enable metrics - metrics format selector should appear
    rerender(<ExportOptionsCard {...mockProps} includeSegmentation={true} includeObjectMetrics={true} />);
    expect(screen.queryAllByTestId('select-native')).toHaveLength(2);
  });

  it('shows warning when no images are selected', () => {
    const propsWithNoImages = {
      ...mockProps,
      getSelectedCount: vi.fn(() => 0),
    };
    
    render(<ExportOptionsCard {...propsWithNoImages} />);
    
    expect(screen.getByText('Please select images for export')).toBeInTheDocument();
  });

  it('handles different format descriptions correctly', () => {
    render(<ExportOptionsCard {...mockProps} includeObjectMetrics={true} />);
    
    // Check if format descriptions are shown
    expect(screen.getByText('Excel spreadsheet with multiple worksheets')).toBeInTheDocument();
  });
});