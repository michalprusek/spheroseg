// React Router future flags are set in index.html

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './styles/tailwind.css';
import './App.css';
import { initPerformanceMonitoring, markPerformance } from './utils/performance';
import logger from './utils/logger';

// Global error handler
const handleError = (error: ErrorEvent) => {
  console.error('Global error:', error);

  // Log detailed error information
  if (error.error && error.error.stack) {
    console.error('Error stack:', error.error.stack);
  }
};

// Add global error listener
window.addEventListener('error', handleError);
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Add fallback for cursor reset in case mouse up events are missed
window.addEventListener('mouseup', () => {
  // Reset cursor if mouse up happens outside of components
  document.body.style.cursor = '';
});

// Initialize performance monitoring
try {
  markPerformance('app-init-start');
  initPerformanceMonitoring();
} catch (error) {
  logger.error('Failed to initialize performance monitoring', { error });
}

// Disable StrictMode in production to avoid double rendering and duplicate API calls
const app =
  import.meta.env.MODE === 'production' ? (
    <App />
  ) : (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

ReactDOM.createRoot(document.getElementById('root')!).render(app);

// Mark application rendered
markPerformance('app-init-end');
