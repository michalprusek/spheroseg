// Set React Router future flags before any tests run
window.REACT_ROUTER_FUTURE_FLAGS = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
  v7_normalizeFormMethod: true,
};

// Patch console.warn to filter out React Router future flags warnings
const originalWarn = console.warn;
console.warn = function (...args) {
  // Filter React Router warnings
  if (args[0] && typeof args[0] === 'string' && args[0].includes('React Router Future Flag Warning')) {
    return; // Ignore these warnings
  }
  originalWarn.apply(console, args);
};

// Also override window.console.warn for handling cases where window is used
if (typeof window !== 'undefined') {
  const originalWindowWarn = window.console.warn;
  window.console.warn = function (...args) {
    // Filter React Router warnings
    if (args[0] && typeof args[0] === 'string' && args[0].includes('React Router Future Flag Warning')) {
      return; // Ignore these warnings
    }
    originalWindowWarn.apply(window.console, args);
  };
}

// This file runs before any test files, ensuring the flags are set
console.log('React Router Future Flags set and warnings patched in test-setup.ts');
