# TODO - Segmentation Editor V2 Rebuild

## Phase 1: Setup & Core Logic

- [ ] Create new core hook `frontend/src/pages/segmentation/hooks/useSegmentationV2.ts`.
    - [ ] Define basic state (zoom, tx, ty, segmentationData, editMode, loading, saving).
    - [ ] Implement coordinate transform logic (`getCanvasCoordinates`, `getScreenCoordinates`).
    - [ ] Implement basic centering logic (`useEffect` to calculate initial `tx`, `ty`).
    - [ ] Implement data fetching (`useEffect` to fetch image & segmentations from API `/api/projects/:projectId/images/:imageId`).
    - [ ] Implement basic save logic (`handleSave` to `PUT /api/projects/:projectId/images/:imageId/segmentations`).
    - [ ] Implement undo/redo using `useUndoRedo`.
- [ ] Create new canvas component `frontend/src/pages/segmentation/components/canvas/CanvasV2.tsx`.
    - [ ] Setup SVG structure with `<g transform={...}>`.
    - [ ] Implement image rendering (`<image>`).
    - [ ] Implement basic polygon rendering (`<polygon>`) from props.
    - [ ] Accept interaction handlers as props.
- [ ] Create new toolbar component `frontend/src/pages/segmentation/components/toolbar/ToolbarV2.tsx`.
    - [ ] Setup basic structure and accept state/handlers as props.
    - [ ] Add basic buttons (Zoom In/Out/Reset, Save, Undo/Redo).
- [ ] Integrate new components into `SegmentationPage.tsx` (or similar main page).
    - [ ] Replace usage of old hooks/components with `useSegmentationV2`, `CanvasV2`, `ToolbarV2`.

## Phase 2: Interactions & Modes

- [ ] Implement Pan & Zoom logic in `useSegmentationV2`.
    - [ ] Update `handleZoom` to modify `tx`, `ty`, `zoom`.
    - [ ] Update `handlePan` (in `handleMouseMove`) to modify `tx`, `ty`.
    - [ ] Update `handleResetView`.
- [ ] Implement Polygon Selection logic in `useSegmentationV2`.
    - [ ] Detect clicks inside polygons (`handleMouseDown`).
    - [ ] Update `selectedPolygonId` state.
- [ ] Implement Edit Vertices mode in `useSegmentationV2`.
    - [ ] Add `EditVertices` to `EditMode` enum.
    - [ ] Render vertices for selected polygon in `CanvasV2`.
    - [ ] Implement vertex dragging logic (`handleMouseDown`, `handleMouseMove`, `handleMouseUp`).
    - [ ] Implement vertex hover effects.
- [ ] Implement Add Points mode in `useSegmentationV2`.
    - [ ] Add `AddPoints` to `EditMode` enum.
    - [ ] Render segment hover effects in `CanvasV2`.
    - [ ] Implement logic to add point on segment click (`handleMouseDown`).
- [ ] Implement Create Polygon mode in `useSegmentationV2`.
    - [ ] Add `CreatePolygon` to `EditMode` enum.
    - [ ] Handle clicks to add new points (`handleMouseDown`).
    - [ ] Render temporary lines (`tempPoints`) in `CanvasV2`.
    - [ ] Handle closing the polygon (click near start or Enter key).
    - [ ] Implement cancellation (Escape key).
- [ ] Implement Delete Polygon mode/action in `useSegmentationV2`.
    - [ ] Add mode or context menu action.
    - [ ] Implement logic to remove selected polygon.
- [ ] Implement Slicing mode in `useSegmentationV2`.
    - [ ] Add `Slice` to `EditMode` enum.
    - [ ] Handle first and second clicks (`handleMouseDown`).
    - [ ] Render temporary slice line (`tempPoints`) in `CanvasV2`.
    - [ ] Implement geometry logic (find intersections).
    - [ ] Implement state update to replace old polygon with new ones.

## Phase 3: Refinement & Integration

- [ ] Refine Toolbar (`ToolbarV2.tsx`) with all mode buttons and state updates.
- [ ] Refine Region Panel (if needed) to work with the new hook/state.
- [ ] Refine Status Bar (if needed).
- [ ] Add keyboard shortcuts.
- [ ] Perform thorough testing and debugging.
- [ ] Code cleanup and optimization.

## Bug Fixes & Testing

- [x] Investigate and fix "Invalid hook call" error in `useSegmentationV2`. (Identified potential cause and applied fix in docker-compose.yml)
- [ ] Add unit tests for `useSegmentationV2` hook.
- [ ] Add integration tests for `SegmentationPage` and backend integration.
