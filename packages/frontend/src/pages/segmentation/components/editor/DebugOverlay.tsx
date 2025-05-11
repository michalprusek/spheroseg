import React, { useState, useEffect } from 'react';
import type { Point } from '@/lib/segmentation';

interface DebugOverlayProps {
  cursorScreenPosition: { left: number; top: number } | null;
  lastClickScreenPosition: { left: number; top: number } | null;
  zoom: number;
  offset: { x: number; y: number };
  canvasWidth?: number;
  canvasHeight?: number;
  imageWidth?: number;
  imageHeight?: number;
}

/**
 * DebugOverlay renders markers and information for debugging coordinate transformations.
 * Shows cursor position, last click, and coordinate system information.
 */
const DebugOverlay: React.FC<DebugOverlayProps> = ({
  cursorScreenPosition,
  lastClickScreenPosition,
  zoom,
  offset,
  canvasWidth = 0,
  canvasHeight = 0,
  imageWidth = 0,
  imageHeight = 0,
}) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Toggle debug info panel with Ctrl+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        setShowDebugInfo((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Calculate the image space coordinates from screen coordinates
  const getImageCoordinates = (screenPos: { left: number; top: number }): Point => {
    // Same transformation as in getCanvasCoords
    return {
      x: screenPos.left / zoom - offset.x,
      y: screenPos.top / zoom - offset.y,
    };
  };

  // Calculate the screen coordinates from image coordinates
  const getScreenCoordinates = (imagePos: Point): { left: number; top: number } => {
    return {
      left: (imagePos.x + offset.x) * zoom,
      top: (imagePos.y + offset.y) * zoom,
    };
  };

  // Calculate image coordinates if screen positions exist
  const imageCoords = cursorScreenPosition ? getImageCoordinates(cursorScreenPosition) : null;

  // Calculate screen coordinates from image coordinates (for verification)
  const verifiedScreenCoords = imageCoords ? getScreenCoordinates(imageCoords) : null;

  // Calculate transformation error (round-trip error)
  const transformError =
    cursorScreenPosition && verifiedScreenCoords
      ? {
          x: Math.abs(cursorScreenPosition.left - verifiedScreenCoords.left),
          y: Math.abs(cursorScreenPosition.top - verifiedScreenCoords.top),
        }
      : null;

  // Calculate center points
  const canvasCenter = { x: canvasWidth / 2, y: canvasHeight / 2 };
  const imageCenter = { x: imageWidth / 2, y: imageHeight / 2 };

  // Calculate image center on canvas
  const imageCenterOnCanvas = getScreenCoordinates(imageCenter);

  return (
    <>
      {/* Original cursor position (blue dot) */}
      {cursorScreenPosition && (
        <div
          style={{
            position: 'absolute',
            left: cursorScreenPosition.left,
            top: cursorScreenPosition.top,
            transform: 'translate(-50%, -50%)',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: 'rgba(0, 200, 255, 0.6)',
            border: '2px solid #00c8ff',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
          title={`Screen: (${Math.round(cursorScreenPosition.left)}, ${Math.round(cursorScreenPosition.top)})`}
        />
      )}

      {/* Last click position (red dot) */}
      {lastClickScreenPosition && (
        <div
          style={{
            position: 'absolute',
            left: lastClickScreenPosition.left,
            top: lastClickScreenPosition.top,
            transform: 'translate(-50%, -50%)',
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: 'rgba(255, 0, 0, 0.5)',
            border: '2px solid #ff0000',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
          title={`Last Click: (${Math.round(lastClickScreenPosition.left)}, ${Math.round(lastClickScreenPosition.top)})`}
        />
      )}

      {/* Canvas center marker (green dot) */}
      <div
        style={{
          position: 'absolute',
          left: canvasCenter.x,
          top: canvasCenter.y,
          transform: 'translate(-50%, -50%)',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'rgba(0, 255, 0, 0.6)',
          border: '2px solid #00ff00',
          pointerEvents: 'none',
          zIndex: 1000,
        }}
        title={`Canvas Center: (${Math.round(canvasCenter.x)}, ${Math.round(canvasCenter.y)})`}
      />

      {/* Image center on canvas marker (purple dot) */}
      <div
        style={{
          position: 'absolute',
          left: imageCenterOnCanvas.left,
          top: imageCenterOnCanvas.top,
          transform: 'translate(-50%, -50%)',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'rgba(255, 0, 255, 0.6)',
          border: '2px solid #ff00ff',
          pointerEvents: 'none',
          zIndex: 1000,
        }}
        title={`Image Center: (${Math.round(imageCenterOnCanvas.left)}, ${Math.round(imageCenterOnCanvas.top)})`}
      />

      {/* Debug info panel */}
      {showDebugInfo && (
        <div
          style={{
            position: 'absolute',
            right: 10,
            top: 10,
            padding: '10px',
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            fontFamily: 'monospace',
            fontSize: '12px',
            borderRadius: '4px',
            zIndex: 2000,
            maxWidth: '300px',
            pointerEvents: 'none',
          }}
        >
          <div>
            <strong>Zoom:</strong> {zoom.toFixed(2)}
          </div>
          <div>
            <strong>Offset:</strong> ({offset.x.toFixed(2)}, {offset.y.toFixed(2)})
          </div>
          {imageCoords && (
            <div>
              <strong>Image Coords:</strong> ({imageCoords.x.toFixed(2)}, {imageCoords.y.toFixed(2)})
            </div>
          )}
          {transformError && (
            <div>
              <strong>Transform Error:</strong> ({transformError.x.toFixed(4)}, {transformError.y.toFixed(4)})
            </div>
          )}
          <div>
            <strong>Canvas Center:</strong> ({canvasCenter.x.toFixed(2)}, {canvasCenter.y.toFixed(2)})
          </div>
          <div>
            <strong>Image Center:</strong> ({imageCenter.x.toFixed(2)}, {imageCenter.y.toFixed(2)})
          </div>
          <div>
            <strong>Image Center on Canvas:</strong> ({imageCenterOnCanvas.left.toFixed(2)},{' '}
            {imageCenterOnCanvas.top.toFixed(2)})
          </div>
          <div style={{ marginTop: '5px', fontSize: '10px' }}>Press Ctrl+D to toggle this panel</div>
        </div>
      )}
    </>
  );
};

export default DebugOverlay;
