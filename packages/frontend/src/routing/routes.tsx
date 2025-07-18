import { Suspense, ReactNode } from 'react';
import { Route, createRoutesFromElements } from 'react-router-dom';
import { createLazyComponent } from '@/types/lazyComponents';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoadingFallback from '@/components/LoadingFallback';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AppLayout } from './AppLayout';
import { RouterErrorBoundary } from './RouterErrorBoundary';

// Helper to create route with proper error boundary and suspense
const createRouteElement = (
  componentName: string,
  loadComponent: () => Promise<{ default: React.ComponentType<any> }>,
  isProtected = false
): ReactNode => {
  const Component = createLazyComponent(
    loadComponent,
    () => import('@/pages/NotFound')
  );

  const element = (
    <ErrorBoundary componentName={componentName}>
      <Suspense fallback={<LoadingFallback />}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  );

  return isProtected ? <ProtectedRoute>{element}</ProtectedRoute> : element;
};

// Route configuration with code splitting
export const routes = createRoutesFromElements(
  <Route element={<AppLayout />} errorElement={<RouterErrorBoundary />}>
    {/* Public routes */}
    <Route
      path="/"
      element={createRouteElement('IndexPage', () => import('@/pages/Index'))}
    />
    <Route
      path="/sign-in"
      element={createRouteElement('SignInPage', () => import('@/pages/SignIn'))}
    />
    <Route
      path="/sign-up"
      element={createRouteElement('SignUpPage', () => import('@/pages/SignUp'))}
    />
    <Route
      path="/verify-email"
      element={createRouteElement('VerifyEmailPage', () => import('@/pages/VerifyEmail'))}
    />
    <Route
      path="/documentation"
      element={createRouteElement('DocumentationPage', () => import('@/pages/Documentation'))}
    />
    <Route
      path="/about"
      element={createRouteElement('AboutPage', () => import('@/pages/AboutPage'))}
    />
    <Route
      path="/terms-of-service"
      element={createRouteElement('TermsOfServicePage', () => import('@/pages/TermsOfService'))}
    />
    <Route
      path="/privacy-policy"
      element={createRouteElement('PrivacyPolicyPage', () => import('@/pages/PrivacyPolicy'))}
    />
    <Route
      path="/request-access"
      element={createRouteElement('RequestAccessPage', () => import('@/pages/RequestAccess'))}
    />
    <Route
      path="/forgot-password"
      element={createRouteElement('ForgotPasswordPage', () => import('@/pages/ForgotPassword'))}
    />

    {/* Protected routes */}
    <Route
      path="/dashboard"
      element={createRouteElement('DashboardPage', () => import('@/pages/Dashboard'), true)}
    />
    <Route
      path="/project/:id"
      element={createRouteElement('ProjectDetailPage', () => import('@/pages/ProjectDetail'), true)}
    />
    <Route
      path="/projects/:id"
      element={createRouteElement('ProjectDetailPage', () => import('@/pages/ProjectDetail'), true)}
    />
    <Route
      path="/images/:imageId/segmentation"
      element={createRouteElement('SegmentationPage', () => import('@/pages/segmentation/SegmentationPage'), true)}
    />
    <Route
      path="/projects/:projectId/segmentation/:imageId"
      element={createRouteElement('SegmentationPage', () => import('@/pages/segmentation/SegmentationPage'), true)}
    />
    <Route
      path="/projects/:projectId/editor/:imageId"
      element={createRouteElement('SegmentationEditorRedirect', () => import('@/pages/segmentation/SegmentationEditorRedirect'), true)}
    />
    <Route
      path="/project/:id/export"
      element={createRouteElement('ProjectExportPage', () => import('@/pages/export/ProjectExport'), true)}
    />
    <Route
      path="/settings"
      element={createRouteElement('SettingsPage', () => import('@/pages/Settings'), true)}
    />
    <Route
      path="/profile"
      element={createRouteElement('ProfilePage', () => import('@/pages/Profile'), true)}
    />
    <Route
      path="/accept-invitation/:token"
      element={createRouteElement('AcceptInvitationPage', () => import('@/pages/AcceptInvitation'))}
    />
    <Route
      path="/invitation/:token"
      element={createRouteElement('AcceptInvitationPage', () => import('@/pages/AcceptInvitation'))}
    />

    {/* Catch-all route */}
    <Route
      path="*"
      element={createRouteElement('NotFoundPage', () => import('@/pages/NotFound'))}
    />
  </Route>
);

// Prefetch critical routes for better performance
export const prefetchRoute = (path: string) => {
  switch (path) {
    case '/dashboard':
      import('@/pages/Dashboard');
      break;
    case '/sign-in':
      import('@/pages/SignIn');
      break;
    // Add more critical routes as needed
  }
};