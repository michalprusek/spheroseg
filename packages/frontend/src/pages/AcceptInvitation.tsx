import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, UserPlus } from 'lucide-react';
import apiClient from '@/lib/apiClient';
import { toast } from 'sonner';

const AcceptInvitation: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'needsLogin'>('loading');
  const [projectInfo, setProjectInfo] = useState<{ title: string; ownerName: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (!isAuthenticated) {
      setStatus('needsLogin');
      return;
    }

    if (!token) {
      setStatus('error');
      setErrorMessage(t('invitation.invalidLink') || 'Invalid invitation link');
      return;
    }

    acceptInvitation();
  }, [isAuthenticated, token]);

  const acceptInvitation = async () => {
    try {
      const response = await apiClient.post(`/api/project-shares/invitation/${token}`);
      const project = response.data.data;

      setProjectInfo({
        title: project.title,
        ownerName: project.ownerName,
      });

      setStatus('success');
      toast.success(t('invitation.acceptedSuccess') || 'Invitation accepted successfully');

      // Redirect to the project after 2 seconds
      setTimeout(() => {
        navigate(`/project/${project.id}`);
      }, 2000);
    } catch (error: any) {
      setStatus('error');

      if (error.response?.status === 404) {
        setErrorMessage(t('invitation.expired') || 'This invitation link has expired or is invalid');
      } else if (error.response?.status === 403) {
        setErrorMessage(t('invitation.notForYou') || 'This invitation is not intended for your account');
      } else {
        setErrorMessage(t('invitation.genericError') || 'Failed to accept invitation. Please try again.');
      }

      toast.error(errorMessage);
    }
  };

  const handleSignIn = () => {
    // Save the current URL to redirect back after sign in
    sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
    navigate('/sign-in');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t('invitation.title') || 'Project Invitation'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'loading' && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
              <p className="text-gray-600 dark:text-gray-400">
                {t('invitation.processing') || 'Processing invitation...'}
              </p>
            </div>
          )}

          {status === 'success' && projectInfo && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('invitation.successTitle') || 'Invitation Accepted!'}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {t('invitation.successMessage', {
                  projectName: projectInfo.title,
                  ownerName: projectInfo.ownerName,
                }) || `You now have access to "${projectInfo.title}" shared by ${projectInfo.ownerName}.`}
              </p>
              <p className="text-sm text-gray-500">{t('invitation.redirecting') || 'Redirecting to project...'}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-8">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {t('invitation.errorTitle') || 'Unable to Accept Invitation'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">{errorMessage}</p>
              <Button onClick={() => navigate('/dashboard')} variant="outline">
                {t('invitation.goToDashboard') || 'Go to Dashboard'}
              </Button>
            </div>
          )}

          {status === 'needsLogin' && (
            <div className="text-center py-8">
              <UserPlus className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('invitation.loginRequired') || 'Sign In Required'}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t('invitation.loginMessage') || 'Please sign in to accept this project invitation.'}
              </p>
              <div className="space-y-2">
                <Button onClick={handleSignIn} className="w-full">
                  {t('invitation.signIn') || 'Sign In'}
                </Button>
                <Button onClick={() => navigate('/sign-up')} variant="outline" className="w-full">
                  {t('invitation.createAccount') || 'Create Account'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvitation;
