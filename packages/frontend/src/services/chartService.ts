import { format, parseISO } from 'date-fns';
import { useTheme } from '@/store';
import { getConfigValue } from '@/config';

/**
 * Unified Chart Service
 * Centralizes chart configuration, theming, and data formatting
 */

// Chart types supported by the unified system
export type ChartType = 
  | 'line' 
  | 'bar' 
  | 'pie' 
  | 'area' 
  | 'scatter' 
  | 'radar' 
  | 'composed' 
  | 'treemap'
  | 'funnel'
  | 'sankey';

// Common chart configuration interface
export interface ChartConfig {
  type: ChartType;
  data: any[];
  dataKeys?: string[];
  xAxisKey?: string;
  yAxisKey?: string;
  title?: string;
  subtitle?: string;
  showLegend?: boolean;
  showTooltip?: boolean;
  showGrid?: boolean;
  height?: number;
  width?: number | string;
  responsive?: boolean;
  animate?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  colors?: string[];
  margin?: { top: number; right: number; bottom: number; left: number };
  customOptions?: Record<string, any>;
}

// Chart theme configuration
export interface ChartTheme {
  colors: {
    primary: string[];
    secondary: string[];
    background: string;
    text: string;
    grid: string;
    tooltip: {
      background: string;
      text: string;
      border: string;
    };
  };
  fonts: {
    family: string;
    size: {
      title: number;
      subtitle: number;
      label: number;
      tick: number;
    };
  };
}

// Predefined color palettes
export const COLOR_PALETTES = {
  default: ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B', '#6B66FF'],
  vibrant: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1F2'],
  pastel: ['#FFD4E5', '#D4E5FF', '#E5FFD4', '#FFEFD4', '#E5D4FF', '#D4FFE5', '#FFE5D4', '#D4D4FF'],
  monochrome: ['#1a1a1a', '#333333', '#4d4d4d', '#666666', '#808080', '#999999', '#b3b3b3', '#cccccc'],
  scientific: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f'],
  medical: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'],
};

// Light theme configuration
const LIGHT_THEME: ChartTheme = {
  colors: {
    primary: COLOR_PALETTES.default,
    secondary: COLOR_PALETTES.pastel,
    background: '#FFFFFF',
    text: '#333333',
    grid: '#E0E0E0',
    tooltip: {
      background: '#FFFFFF',
      text: '#333333',
      border: '#E0E0E0',
    },
  },
  fonts: {
    family: 'Inter, system-ui, -apple-system, sans-serif',
    size: {
      title: 20,
      subtitle: 14,
      label: 12,
      tick: 10,
    },
  },
};

// Dark theme configuration
const DARK_THEME: ChartTheme = {
  colors: {
    primary: COLOR_PALETTES.vibrant,
    secondary: COLOR_PALETTES.default,
    background: '#1F2937',
    text: '#E5E7EB',
    grid: '#374151',
    tooltip: {
      background: '#374151',
      text: '#E5E7EB',
      border: '#4B5563',
    },
  },
  fonts: {
    family: 'Inter, system-ui, -apple-system, sans-serif',
    size: {
      title: 20,
      subtitle: 14,
      label: 12,
      tick: 10,
    },
  },
};

class ChartService {
  /**
   * Get theme configuration based on current theme
   */
  getTheme(theme: 'light' | 'dark' | 'auto' = 'auto'): ChartTheme {
    if (theme === 'auto') {
      const isDark = document.documentElement.classList.contains('dark');
      return isDark ? DARK_THEME : LIGHT_THEME;
    }
    return theme === 'dark' ? DARK_THEME : LIGHT_THEME;
  }

  /**
   * Get color palette for charts
   */
  getColors(palette: keyof typeof COLOR_PALETTES = 'default', count?: number): string[] {
    const colors = COLOR_PALETTES[palette] || COLOR_PALETTES.default;
    if (count && count > colors.length) {
      // Generate additional colors if needed
      return this.generateColors(count, colors);
    }
    return colors.slice(0, count);
  }

  /**
   * Generate additional colors based on existing palette
   */
  private generateColors(count: number, baseColors: string[]): string[] {
    const colors = [...baseColors];
    const needed = count - colors.length;
    
    for (let i = 0; i < needed; i++) {
      const baseColor = colors[i % baseColors.length];
      const variation = this.adjustColorBrightness(baseColor, 1 + (i / needed) * 0.5);
      colors.push(variation);
    }
    
    return colors;
  }

  /**
   * Adjust color brightness
   */
  private adjustColorBrightness(color: string, factor: number): string {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    const newR = Math.min(255, Math.floor(r * factor));
    const newG = Math.min(255, Math.floor(g * factor));
    const newB = Math.min(255, Math.floor(b * factor));
    
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }

  /**
   * Format number for display
   */
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    const defaultOptions: Intl.NumberFormatOptions = {
      maximumFractionDigits: 2,
      notation: 'compact',
      ...options,
    };
    
    return new Intl.NumberFormat('en-US', defaultOptions).format(value);
  }

  /**
   * Format percentage
   */
  formatPercentage(value: number, decimals = 1): string {
    return `${value.toFixed(decimals)}%`;
  }

  /**
   * Format date for charts
   */
  formatDate(date: string | Date, formatStr = 'MMM dd'): string {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, formatStr);
  }

  /**
   * Format currency
   */
  formatCurrency(value: number, currency = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  /**
   * Prepare data for time series charts
   */
  prepareTimeSeriesData(
    data: any[],
    dateKey: string,
    valueKeys: string[],
    interval: 'day' | 'week' | 'month' | 'year' = 'day'
  ): any[] {
    // Group by interval and aggregate
    const grouped = data.reduce((acc, item) => {
      const date = this.getIntervalKey(item[dateKey], interval);
      if (!acc[date]) {
        acc[date] = { date, count: 0 };
        valueKeys.forEach(key => acc[date][key] = 0);
      }
      acc[date].count++;
      valueKeys.forEach(key => {
        acc[date][key] += item[key] || 0;
      });
      return acc;
    }, {} as Record<string, any>);
    
    return Object.values(grouped).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }

  /**
   * Get interval key for grouping
   */
  private getIntervalKey(date: string | Date, interval: string): string {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    switch (interval) {
      case 'day':
        return format(dateObj, 'yyyy-MM-dd');
      case 'week':
        return format(dateObj, 'yyyy-ww');
      case 'month':
        return format(dateObj, 'yyyy-MM');
      case 'year':
        return format(dateObj, 'yyyy');
      default:
        return format(dateObj, 'yyyy-MM-dd');
    }
  }

  /**
   * Calculate statistics for a dataset
   */
  calculateStatistics(data: number[]): {
    min: number;
    max: number;
    mean: number;
    median: number;
    sum: number;
    count: number;
    stdDev: number;
  } {
    const sorted = [...data].sort((a, b) => a - b);
    const sum = data.reduce((acc, val) => acc + val, 0);
    const mean = sum / data.length;
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    
    const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      min: Math.min(...data),
      max: Math.max(...data),
      mean,
      median,
      sum,
      count: data.length,
      stdDev,
    };
  }

  /**
   * Generate chart configuration with defaults
   */
  createChartConfig(options: Partial<ChartConfig>): ChartConfig {
    const theme = this.getTheme(options.theme);
    
    return {
      type: 'bar',
      data: [],
      showLegend: true,
      showTooltip: true,
      showGrid: true,
      responsive: true,
      animate: true,
      theme: 'auto',
      colors: theme.colors.primary,
      margin: { top: 20, right: 20, bottom: 20, left: 20 },
      ...options,
    };
  }

  /**
   * Export chart as image
   */
  async exportChartAsImage(
    chartElement: HTMLElement,
    filename: string = 'chart',
    format: 'png' | 'jpeg' | 'svg' = 'png'
  ): Promise<void> {
    try {
      // Dynamic import to avoid bundling if not used
      const html2canvas = (await import('html2canvas')).default;
      
      if (format === 'svg') {
        // For SVG export, we need to extract the SVG element
        const svgElement = chartElement.querySelector('svg');
        if (svgElement) {
          const svgData = new XMLSerializer().serializeToString(svgElement);
          const blob = new Blob([svgData], { type: 'image/svg+xml' });
          this.downloadBlob(blob, `${filename}.svg`);
        }
      } else {
        // For PNG/JPEG, use html2canvas
        const canvas = await html2canvas(chartElement, {
          backgroundColor: format === 'png' ? null : '#FFFFFF',
        });
        
        canvas.toBlob((blob) => {
          if (blob) {
            this.downloadBlob(blob, `${filename}.${format}`);
          }
        }, `image/${format}`);
      }
    } catch (error) {
      console.error('Failed to export chart:', error);
      throw new Error('Chart export failed');
    }
  }

  /**
   * Export chart data as CSV
   */
  exportChartDataAsCSV(data: any[], filename: string = 'chart-data'): void {
    if (!data.length) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') 
            ? `"${value}"` 
            : value;
        }).join(',')
      ),
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    this.downloadBlob(blob, `${filename}.csv`);
  }

  /**
   * Download blob as file
   */
  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Get responsive chart dimensions
   */
  getResponsiveDimensions(
    container: HTMLElement | null,
    aspectRatio: number = 16 / 9
  ): { width: number; height: number } {
    if (!container) {
      return { width: 800, height: 450 };
    }
    
    const width = container.clientWidth;
    const height = width / aspectRatio;
    
    return { width, height };
  }

  /**
   * Create gradient colors for charts
   */
  createGradient(
    color: string,
    opacity: { start: number; end: number } = { start: 0.8, end: 0.1 }
  ): string {
    // This returns a gradient definition ID that can be used in SVG
    return `gradient-${color.replace('#', '')}-${opacity.start}-${opacity.end}`;
  }
}

// Export singleton instance
export const chartService = new ChartService();

// Export types and constants
export { COLOR_PALETTES, LIGHT_THEME, DARK_THEME };
export type { ChartTheme };