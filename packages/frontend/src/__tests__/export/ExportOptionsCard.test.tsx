import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import ExportOptionsCard from '@/pages/export/components/ExportOptionsCard';
import type { AnnotationFormat, MetricsFormat } from '@/pages/export/components/ExportOptionsCard';

// Mock language context
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key, // Return the key as-is for testing
  }),
}));

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => <button onClick={onClick} {...props}>{children}</button>,
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select value={value} onChange={(e) => onValueChange?.(e.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => children,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => children,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  FileSpreadsheet: () => <div data-testid="file-spreadsheet-icon" />,
  Image: () => <div data-testid="image-icon" />,
  FileText: () => <div data-testid="file-text-icon" />,
}));

describe('ExportOptionsCard', () => {
  // Create mock props for the component
  const mockProps = {
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

  it('renders the export options card with all checkboxes', () => {
    render(<ExportOptionsCard {...mockProps} />);

    // Check title
    expect(screen.getByText('export.title')).toBeInTheDocument();

    // Check checkboxes
    expect(screen.getByLabelText('export.options.includeMetadata')).toBeInTheDocument();
    expect(screen.getByLabelText('export.options.includeSegmentation')).toBeInTheDocument();
    expect(screen.getByLabelText('export.options.includeObjectMetrics')).toBeInTheDocument();
    expect(screen.getByLabelText('export.options.includeImages')).toBeInTheDocument();
  });

  it('shows annotation format options when includeSegmentation is true', () => {
    render(<ExportOptionsCard {...mockProps} />);

    // Use getAllByText since the text appears multiple times (label and select placeholder)
    const exportFormatTexts = screen.getAllByText(/export.options.selectExportFormat/);
    expect(exportFormatTexts.length).toBeGreaterThan(0);
  });

  it('hides annotation format options when includeSegmentation is false', () => {
    render(<ExportOptionsCard {...mockProps} includeSegmentation={false} />);

    expect(screen.queryByText(/export.options.selectExportFormat/)).not.toBeInTheDocument();
  });

  it('shows metrics format options when includeObjectMetrics is true', () => {
    render(<ExportOptionsCard {...mockProps} />);

    // Use getAllByText since the text appears multiple times (label and select placeholder)
    const metricsFormatTexts = screen.getAllByText(/export.options.selectMetricsFormat/);
    expect(metricsFormatTexts.length).toBeGreaterThan(0);
  });

  it('hides metrics format options when includeObjectMetrics is false', () => {
    render(<ExportOptionsCard {...mockProps} includeObjectMetrics={false} />);

    expect(screen.queryByText(/export.options.selectMetricsFormat/)).not.toBeInTheDocument();
  });

  it('calls setIncludeMetadata when metadata checkbox is clicked', () => {
    render(<ExportOptionsCard {...mockProps} />);

    fireEvent.click(screen.getByLabelText('export.options.includeMetadata'));

    expect(mockProps.setIncludeMetadata).toHaveBeenCalled();
  });

  it('calls setIncludeSegmentation when segmentation checkbox is clicked', () => {
    render(<ExportOptionsCard {...mockProps} />);

    fireEvent.click(screen.getByLabelText('export.options.includeSegmentation'));

    expect(mockProps.setIncludeSegmentation).toHaveBeenCalled();
  });

  it('calls setIncludeObjectMetrics when metrics checkbox is clicked', () => {
    render(<ExportOptionsCard {...mockProps} />);

    fireEvent.click(screen.getByLabelText('export.options.includeObjectMetrics'));

    expect(mockProps.setIncludeObjectMetrics).toHaveBeenCalled();
  });

  it('calls setIncludeImages when images checkbox is clicked', () => {
    render(<ExportOptionsCard {...mockProps} />);

    fireEvent.click(screen.getByLabelText('export.options.includeImages'));

    expect(mockProps.setIncludeImages).toHaveBeenCalled();
  });

  it('calls handleExportMetricsAsXlsx when export metrics button is clicked', () => {
    render(<ExportOptionsCard {...mockProps} />);

    fireEvent.click(screen.getByText('export.options.exportMetricsOnly'));

    expect(mockProps.handleExportMetricsAsXlsx).toHaveBeenCalled();
  });

  it('disables export metrics button when isExporting is true', () => {
    render(<ExportOptionsCard {...mockProps} isExporting={true} />);

    expect(screen.getByText('export.options.exportMetricsOnly').closest('button')).toBeDisabled();
  });

  it('disables export metrics button when no images are selected', () => {
    render(<ExportOptionsCard {...mockProps} getSelectedCount={vi.fn().mockReturnValue(0)} />);

    expect(screen.getByText('export.options.exportMetricsOnly').closest('button')).toBeDisabled();
  });

  it('shows warning when no images are selected', () => {
    render(<ExportOptionsCard {...mockProps} getSelectedCount={vi.fn().mockReturnValue(0)} />);

    expect(screen.getByText('export.selectImagesForExport')).toBeInTheDocument();
  });
});
