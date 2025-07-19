/**
 * Slicing Utilities
 *
 * This file re-exports slicing-related functions from the unified polygon utilities
 * for backward compatibility. All new code should import from polygonUtils directly.
 *
 * @deprecated Use @spheroseg/shared/utils/polygonUtils instead
 */
export type { Polygon } from '../polygonUtils';
export { slicePolygon, slicePolygonObject, createPolygon } from '../polygonUtils';
//# sourceMappingURL=slicingUtils.d.ts.map