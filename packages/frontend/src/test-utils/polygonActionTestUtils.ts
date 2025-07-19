import { act, RenderHookResult } from '@testing-library/react-hooks';
import { SegmentationResult } from '@/lib/segmentation';
import { toast } from 'sonner';
import { vi } from 'vitest';

type PolygonActions = {
  [key: string]: (...args: unknown[]) => any;
};

/**
 * Test utility function to test polygon action handlers
 *
 * @param segmentation The segmentation data
 * @param setSegmentation Mock function for updating segmentation
 * @param selectedPolygonId Currently selected polygon ID
 * @param setSelectedPolygonId Mock function for updating selected polygon
 * @param togglePointAddingMode Mock function for point adding mode toggle
 * @param toggleSlicingMode Mock function for slicing mode toggle
 * @param renderHookFn Function that renders the hook with all parameters
 * @param actionName Name of the action/handler to test
 * @param actionArgs Optional arguments to pass to the handler
 * @returns The result from renderHook
 */
export const testPolygonAction = <T extends PolygonActions>(
  segmentation: Partial<SegmentationResult>,
  setSegmentation: jest.Mock | ReturnType<typeof vi.fn>,
  selectedPolygonId: string | null,
  setSelectedPolygonId: jest.Mock | ReturnType<typeof vi.fn>,
  togglePointAddingMode: jest.Mock | ReturnType<typeof vi.fn>,
  toggleSlicingMode: jest.Mock | ReturnType<typeof vi.fn>,
  renderHookFn: (params: unknown) => RenderHookResult<any, T>,
  actionName: keyof T,
  ...actionArgs: unknown[]
) => {
  const result = renderHookFn({
    segmentation,
    setSegmentation,
    selectedPolygonId,
    setSelectedPolygonId,
    togglePointAddingMode,
    toggleSlicingMode,
  });

  let returnValue;
  act(() => {
    returnValue = result.current[actionName](...actionArgs);
  });

  // Common assertions that were duplicated
  expect(setSegmentation).toHaveBeenCalled();
  expect(toast.success).toHaveBeenCalled();

  return { result, returnValue };
};
