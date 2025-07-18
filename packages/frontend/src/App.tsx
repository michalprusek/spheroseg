import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { toast } from 'sonner';
import ErrorBoundary from './components/ErrorBoundary';
import { routes, prefetchRoute } from './routing/routes';

// i18n
import './i18n';

// Debug i18next issue
import '@/utils/debugI18next';

// Import accessibility CSS
import './components/a11y/SkipLink.css';

// Export prefetchRoute for external use
export { prefetchRoute };

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes (reduces unnecessary refetches)
      gcTime: 10 * 60 * 1000, // 10 minutes (cache time)
    },
    mutations: {
      onError: () => {
        // Display error to the user via toast notification
        toast.error('Failed to update data. Please try again.');
      },
    },
  },
});

// Prefetch critical routes on app initialization
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
