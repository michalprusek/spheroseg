import React from 'react';
import { vi } from 'vitest';
import { EditMode } from '@/pages/segmentation/hooks/segmentation';
import { renderWithProviders } from '../../../../../../shared/test-utils/componentTestUtils';

// Common test props for StatusBarV2 component
export const defaultStatusBarProps = {
  zoom: 1.5,
  imageCoords: { x: 100, y: 200 },
  editMode: EditMode.View,
  selectedPolygonId: 'test-polygon-id',
  polygonCount: 3,
  vertexCount: 12,
  imageWidth: 1024,
  imageHeight: 768,
};

// Render helper for StatusBar components
export function renderStatusBar(ui: React.ReactElement, options = {}) {
  return renderWithProviders(ui, {
    withLanguage: true,
    ...options,
  });
}

// Verification helpers for StatusBar tests
export function verifyStatusBarValues(
  screen: any,
  {
    zoom = 1.5,
    coords = { x: 100, y: 200 },
    width = 1024,
    height = 768,
    polygonCount = 3,
    vertexCount = 12,
    selectedPolygonId = 'test-polygon-id',
    mode = EditMode.View,
  } = {},
) {
  // Check zoom value
  if (zoom) {
    const zoomPercent = Math.round(zoom * 100);
    expect(screen.getByText(new RegExp(`${zoomPercent}%`))).toBeInTheDocument();
  }

  // Check coordinates
  if (coords) {
    expect(screen.getByText(new RegExp(`X: ${coords.x}, Y: ${coords.y}`))).toBeInTheDocument();
  }

  // Check resolution
  if (width && height) {
    expect(screen.getByText(new RegExp(`${width} × ${height} px`))).toBeInTheDocument();
  }

  // Check edit mode
  if (mode === EditMode.View) {
    expect(screen.getByText(/segmentation.modes.view/)).toBeInTheDocument();
  } else if (mode === EditMode.CreatePolygon) {
    expect(screen.getByText(/segmentation.modes.createPolygon/)).toBeInTheDocument();
  } else if (mode === EditMode.DeletePolygon) {
    expect(screen.getByText(/segmentation.modes.deletePolygon/)).toBeInTheDocument();
  }

  // Check selected polygon ID
  if (selectedPolygonId) {
    expect(screen.getByText(`#${selectedPolygonId.substring(0, 8)}`)).toBeInTheDocument();
  } else {
    expect(screen.getByText(/segmentation.none/)).toBeInTheDocument();
  }

  // Check polygon count
  if (polygonCount !== undefined) {
    expect(screen.getByText(new RegExp(`${polygonCount}$`))).toBeInTheDocument();
  }

  // Check vertex count
  if (vertexCount !== undefined) {
    expect(screen.getByText(new RegExp(`${vertexCount}$`))).toBeInTheDocument();
  }
}
