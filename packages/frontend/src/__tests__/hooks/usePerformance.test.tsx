import { renderHook, act } from '@testing-library/react-hooks';
import { usePerformance } from '@/hooks/usePerformance';
import { markPerformance, measurePerformance } from '@/utils/performance';

// Mock the performance utilities
jest.mock('@/utils/performance', () => ({
  markPerformance: jest.fn(),
  measurePerformance: jest.fn(() => 100), // Mock return value of 100ms
  clearPerformanceMarks: jest.fn(),
}));

// Mock the logger
jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('usePerformance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock performance.now
    if (!window.performance) {
      Object.defineProperty(window, 'performance', {
        value: {
          now: jest.fn(() => Date.now()),
          mark: jest.fn(),
          measure: jest.fn(),
          getEntriesByName: jest.fn(() => [{ duration: 100 }]),
          clearMarks: jest.fn(),
          clearMeasures: jest.fn(),
        },
        writable: true,
      });
    } else {
      window.performance.now = jest.fn(() => Date.now());
    }
  });

  it('should mark component mount and render', () => {
    const { result, unmount } = renderHook(() => usePerformance('TestComponent'));

    // Should have marked render start and end
    expect(markPerformance).toHaveBeenCalledWith('TestComponent-render-0-start');
    expect(markPerformance).toHaveBeenCalledWith('TestComponent-render-0-end');

    // Should have marked mount end
    expect(markPerformance).toHaveBeenCalledWith('TestComponent-mount-end');

    // Unmount to test unmount marking
    unmount();

    // Should have marked unmount start
    expect(markPerformance).toHaveBeenCalledWith('TestComponent-unmount-start');

    // Wait for setTimeout to complete
    jest.runAllTimers();

    // Should have marked unmount end
    expect(markPerformance).toHaveBeenCalledWith('TestComponent-unmount-end');
  });

  it('should provide manual performance measurement functions', () => {
    const { result } = renderHook(() => usePerformance('TestComponent'));

    // Test mark function
    act(() => {
      result.current.mark('custom-mark');
    });
    expect(markPerformance).toHaveBeenCalledWith('TestComponent-custom-mark');

    // Test measure function
    act(() => {
      result.current.measure('custom-measure', 'start-mark', 'end-mark');
    });
    expect(measurePerformance).toHaveBeenCalledWith(
      'TestComponent-custom-measure',
      'TestComponent-start-mark',
      'TestComponent-end-mark',
    );

    // Test startMeasure function
    let measureOperation;
    act(() => {
      measureOperation = result.current.startMeasure('operation');
    });
    expect(markPerformance).toHaveBeenCalledWith('TestComponent-operation-start');

    // Test stop function
    act(() => {
      measureOperation.stop();
    });
    expect(markPerformance).toHaveBeenCalledWith('TestComponent-operation-end');
  });

  it('should respect options to disable measurements', () => {
    const { result, unmount } = renderHook(() =>
      usePerformance('TestComponent', {
        measureMount: false,
        measureRender: false,
        measureUnmount: false,
        logMeasurements: false,
      }),
    );

    // Should not have marked render or mount
    expect(markPerformance).not.toHaveBeenCalledWith('TestComponent-render-0-start');
    expect(markPerformance).not.toHaveBeenCalledWith('TestComponent-mount-end');

    // Unmount
    unmount();

    // Should not have marked unmount
    expect(markPerformance).not.toHaveBeenCalledWith('TestComponent-unmount-start');
  });
});
