import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { routes } from './routing/routes';
import { queryClient } from './config/queryClient';
import { initializeRoutePrefetching } from './routing/routePrefetching';

// i18n
import './i18n';

// Debug i18next issue
import '@/utils/debugI18next';

// Import accessibility CSS
import './components/a11y/SkipLink.css';

// Initialize route prefetching on app start
if (typeof window !== 'undefined') {
  initializeRoutePrefetching();
}

// Prefetch critical routes on app initialization
const prefetchRoute = (path: string) => {
  // Prefetch route by creating a link element with prefetch
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = path;
  document.head.appendChild(link);
};

if (typeof window !== 'undefined') {
  // Prefetch sign-in page for faster navigation
  setTimeout(() => prefetchRoute('/sign-in'), 1000);

  // If user is logged in, prefetch dashboard
  const token = localStorage.getItem('access_token');
  if (token) {
    setTimeout(() => prefetchRoute('/dashboard'), 1000);
  }
}

// Create the router with future flags to remove warnings
const router = createBrowserRouter(routes, {
  future: {
    v7_relativeSplatPath: true,
    v7_normalizeFormMethod: true,
    v7_fetcherPersist: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
    v7_startTransition: true,
  },
});

const App = () => (
  <ErrorBoundary componentName="App" resetOnPropsChange={true}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
