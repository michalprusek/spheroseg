import React from 'react';

interface CanvasContentProps {
  children: React.ReactNode;
}

/**
 * Container for canvas content.
 * Parent component is responsible for applying transformations (zoom/offset).
 */
const CanvasContent = ({ children }: CanvasContentProps) => {
  return (
    <div
      style={{
        // Container itself is not transformed, but positions children
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%', // Take full container size
        height: '100%',
        overflow: 'hidden', // Hide content outside container bounds
        // Retain willChange for performance if parent applies transforms
        willChange: 'transform',
      }}
      className="absolute top-0 left-0"
      data-testid="canvas-content-container" // Renamed test ID
    >
      {/* Children are rendered directly, transformation handled by parent */}
      {children}
    </div>
  );
};

export default CanvasContent;
