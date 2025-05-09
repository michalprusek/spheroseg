import React, { Suspense, lazy } from 'react';
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createBrowserRouter,
  RouterProvider,
  useRouteError,
  isRouteErrorResponse,
  Route,
  createRoutesFromElements,
  Outlet,
  useLocation
} from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { SocketProvider } from "@/contexts/SocketContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoadingFallback from './components/LoadingFallback';
import ErrorBoundary from './components/ErrorBoundary';
import { SkipLink } from './components/a11y';
import ThemedFooter from './components/ThemedFooter';
import { toast } from "sonner";
import { handleError, ErrorType } from './utils/errorHandling';

// Import accessibility CSS
import './components/a11y/SkipLink.css';

// Lazy load components with improved error handling
const Index = lazy(() => import("./pages/Index").catch(error => {
  console.error("Error loading Index page:", error);
  return import("./pages/NotFound");
}));
const SignIn = lazy(() => import("./pages/SignIn").catch(error => {
  console.error("Error loading SignIn page:", error);
  return import("./pages/NotFound");
}));
const SignUp = lazy(() => import("./pages/SignUp").catch(error => {
  console.error("Error loading SignUp page:", error);
  return import("./pages/NotFound");
}));
const Dashboard = lazy(() => import("./pages/Dashboard").catch(error => {
  console.error("Error loading Dashboard page:", error);
  return import("./pages/NotFound");
}));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail").catch(error => {
  console.error("Error loading ProjectDetail page:", error);
  return import("./pages/NotFound");
}));
const SegmentationPage = lazy(() => import("./pages/segmentation/SegmentationPage")
  .then(module => ({ default: module.SegmentationPage }))
  .catch(error => {
    console.error("Error loading SegmentationPage:", error);
    return import("./pages/NotFound");
  })
);
const NotFound = lazy(() => import("./pages/NotFound"));
const Settings = lazy(() => import("./pages/Settings").catch(error => {
  console.error("Error loading Settings page:", error);
  return import("./pages/NotFound");
}));
const Profile = lazy(() => import("./pages/Profile").catch(error => {
  console.error("Error loading Profile page:", error);
  return import("./pages/NotFound");
}));
const TermsOfService = lazy(() => import("./pages/TermsOfService").catch(error => {
  console.error("Error loading TermsOfService page:", error);
  return import("./pages/NotFound");
}));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy").catch(error => {
  console.error("Error loading PrivacyPolicy page:", error);
  return import("./pages/NotFound");
}));
const RequestAccess = lazy(() => import("./pages/RequestAccess").catch(error => {
  console.error("Error loading RequestAccess page:", error);
  return import("./pages/NotFound");
}));
const Documentation = lazy(() => import("./pages/Documentation").catch(error => {
  console.error("Error loading Documentation page:", error);
  return import("./pages/NotFound");
}));
const ProjectExport = lazy(() => import("./pages/export/ProjectExport").catch(error => {
  console.error("Error loading ProjectExport page:", error);
  return import("./pages/NotFound");
}));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword")
  .then(module => ({ default: module.default }))
  .catch(error => {
    console.error("Error loading ForgotPassword page:", error);
    return import("./pages/NotFound");
  })
);
const SegmentationEditorRedirect = lazy(() => import("./pages/segmentation/SegmentationEditorRedirect").catch(error => {
  console.error("Error loading SegmentationEditorRedirect page:", error);
  return import("./pages/NotFound");
}));

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 60000, // 1 minute (reduces unnecessary refetches)
    },
    mutations: {
      onError: (error: unknown) => {
        console.error("Mutation error:", error);
        toast.error("Failed to update data. Please try again.");
      }
    }
  },
});

// Router error boundary component
function RouterErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
            {error.status} {error.statusText}
          </h1>
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            {error.data?.message || "Something went wrong while loading this page."}
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-700"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
          Unexpected Error
        </h1>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          Something went wrong. Please try again later.
        </p>
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-700"
        >
          Return to Home
        </a>
      </div>
    </div>
  );
}



// Layout component to wrap all routes
const AppLayout = () => {
  // Use location to conditionally render the footer
  const location = useLocation();

  // Pages that should not have a footer
  const noFooterPages = ['/sign-in', '/sign-up', '/request-access'];
  const shouldShowFooter = !noFooterPages.includes(location.pathname);

  return (
    <AuthProvider>
      <LanguageProvider>
        <ThemeProvider>
          <ProfileProvider>
            <SocketProvider>
              <SkipLink targetId="main-content" />
              <div className="app-container animate-fade-in flex flex-col min-h-screen">
                <main id="main-content" tabIndex={-1} className="flex-grow">
                  <Suspense fallback={<LoadingFallback />}>
                    <Outlet />
                  </Suspense>
                </main>
                {shouldShowFooter && <ThemedFooter />}
              </div>
            </SocketProvider>
          </ProfileProvider>
        </ThemeProvider>
      </LanguageProvider>
    </AuthProvider>
  );
};



// Create routes using the createRoutesFromElements function
const routes = createRoutesFromElements(
  <Route element={<AppLayout />} errorElement={<RouterErrorBoundary />}>
    <Route path="/" element={
      <ErrorBoundary componentName="IndexPage">
        <Index />
      </ErrorBoundary>
    } />
    <Route path="/sign-in" element={
      <ErrorBoundary componentName="SignInPage">
        <SignIn />
      </ErrorBoundary>
    } />
    <Route path="/sign-up" element={
      <ErrorBoundary componentName="SignUpPage">
        <SignUp />
      </ErrorBoundary>
    } />
    <Route path="/documentation" element={
      <ErrorBoundary componentName="DocumentationPage">
        <Documentation />
      </ErrorBoundary>
    } />
    <Route path="/terms-of-service" element={
      <ErrorBoundary componentName="TermsOfServicePage">
        <TermsOfService />
      </ErrorBoundary>
    } />
    <Route path="/privacy-policy" element={
      <ErrorBoundary componentName="PrivacyPolicyPage">
        <PrivacyPolicy />
      </ErrorBoundary>
    } />
    <Route path="/request-access" element={
      <ErrorBoundary componentName="RequestAccessPage">
        <RequestAccess />
      </ErrorBoundary>
    } />
    <Route path="/forgot-password" element={
      <ErrorBoundary componentName="ForgotPasswordPage">
        <Suspense fallback={<LoadingFallback />}>
          <ForgotPassword />
        </Suspense>
      </ErrorBoundary>
    } />
    <Route path="/dashboard" element={
      <ProtectedRoute>
        <ErrorBoundary componentName="DashboardPage">
          <Dashboard />
        </ErrorBoundary>
      </ProtectedRoute>
    } />
    {/* Use unified ProjectDetail component with redirect capability */}
    <Route path="/project/:id" element={
      <ProtectedRoute>
        <ErrorBoundary componentName="ProjectDetailPage">
          <ProjectDetail />
        </ErrorBoundary>
      </ProtectedRoute>
    } />
    {/* Ensure both URL formats work properly */}
    <Route path="/projects/:id" element={
      <ProtectedRoute>
        <ErrorBoundary componentName="ProjectDetailPage">
          <ProjectDetail />
        </ErrorBoundary>
      </ProtectedRoute>
    } />
    <Route path="/projects/:projectId/segmentation/:imageId" element={
      <ProtectedRoute>
        <ErrorBoundary componentName="SegmentationPage">
          <SegmentationPage />
        </ErrorBoundary>
      </ProtectedRoute>
    } />
    {/* Add route for old segmentation editor path */}
    <Route path="/projects/:projectId/editor/:imageId" element={
      <ProtectedRoute>
        <ErrorBoundary componentName="SegmentationEditorRedirect">
          <Suspense fallback={<LoadingFallback />}>
            <SegmentationEditorRedirect />
          </Suspense>
        </ErrorBoundary>
      </ProtectedRoute>
    } />
    <Route path="/project/:id/export" element={
      <ProtectedRoute>
        <ErrorBoundary componentName="ProjectExportPage">
          <ProjectExport />
        </ErrorBoundary>
      </ProtectedRoute>
    } />
    <Route path="/settings" element={
      <ProtectedRoute>
        <ErrorBoundary componentName="SettingsPage">
          <Settings />
        </ErrorBoundary>
      </ProtectedRoute>
    } />
    <Route path="/profile" element={
      <ProtectedRoute>
        <ErrorBoundary componentName="ProfilePage">
          <Profile />
        </ErrorBoundary>
      </ProtectedRoute>
    } />
    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
    <Route path="*" element={
      <ErrorBoundary componentName="NotFoundPage">
        <Suspense fallback={<LoadingFallback />}>
          <NotFound />
        </Suspense>
      </ErrorBoundary>
    } />
  </Route>
);

// Create the router with future flags to remove warnings
const router = createBrowserRouter(routes, {
  future: {
    v7_relativeSplatPath: true,
    v7_normalizeFormMethod: true
  }
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
