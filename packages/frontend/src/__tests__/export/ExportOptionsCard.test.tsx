import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ExportOptionsCard from '@/pages/export/components/ExportOptionsCard';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { createMockExportOptions } from '../../shared/test-utils/export-test-utils';

// Mock language context
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'en',
  }),
}));

describe('ExportOptionsCard', () => {
  // Use shared mock props
  const mockProps = createMockExportOptions();

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

    expect(screen.getByText(/export.options.selectExportFormat/)).toBeInTheDocument();
  });

  it('hides annotation format options when includeSegmentation is false', () => {
    render(<ExportOptionsCard {...mockProps} includeSegmentation={false} />);

    expect(screen.queryByText(/export.options.selectExportFormat/)).not.toBeInTheDocument();
  });

  it('shows metrics format options when includeObjectMetrics is true', () => {
    render(<ExportOptionsCard {...mockProps} />);

    expect(screen.getByText(/export.options.selectMetricsFormat/)).toBeInTheDocument();
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
