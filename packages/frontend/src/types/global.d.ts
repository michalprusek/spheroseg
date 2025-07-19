/**
 * Global type declarations for window and global objects
 */

import type { i18n } from 'i18next';

declare global {
  interface Window {
    // i18next instance for debugging
    i18next?: i18n;
    
    // Google Analytics
    gtag?: (...args: unknown[]) => void;
    
    // Redux DevTools
    __REDUX_DEVTOOLS_EXTENSION__?: () => unknown;
    
    // Custom debugging functions
    clearImageCache?: () => Promise<void>;
    testLocalStoragePersistence?: () => void;
    debugI18next?: () => void;
    
    // IndexedDB (already exists but good to be explicit)
    indexedDB: IDBFactory;
  }
  
  // Node.js global extensions
  interface Global {
    Worker?: typeof Worker;
  }
}

export {};