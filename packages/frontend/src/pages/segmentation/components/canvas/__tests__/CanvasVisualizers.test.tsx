import TemporaryEditPath from '../TemporaryEditPath';
import SlicingModeVisualizer from '../SlicingModeVisualizer';
import PointAddingVisualizer from '../pointAddingVisualizer';
import {
  testTemporaryEditPath,
  testSlicingModeVisualizer,
  testPointAddingVisualizer,
} from '../../../../../../shared/test-utils/canvas-visualizer-utils';

describe('Canvas Visualizer Components', () => {
  // Using consolidated test utilities for each visualizer component
  testTemporaryEditPath(TemporaryEditPath);
  testSlicingModeVisualizer(SlicingModeVisualizer);
  testPointAddingVisualizer(PointAddingVisualizer);
});
