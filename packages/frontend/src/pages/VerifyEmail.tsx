import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { verifyEmail } from '@/api/auth';
import { useLanguage } from '@/contexts/LanguageContext';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setErrorMessage(t('auth.invalidVerificationLink') || 'Invalid verification link');
      return;
    }

    const verifyToken = async () => {
      try {
        await verifyEmail(token);
        setStatus('success');
      } catch (error: any) {
        setStatus('error');
        setErrorMessage(error.response?.data?.message || t('auth.verificationFailed') || 'Email verification failed');
      }
    };

    verifyToken();
  }, [searchParams, t]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 dark:from-gray-800 dark:via-gray-900 dark:to-black">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>
            {status === 'loading' && (t('auth.verifyingEmail') || 'Verifying Email')}
            {status === 'success' && (t('auth.emailVerified') || 'Email Verified!')}
            {status === 'error' && (t('auth.verificationError') || 'Verification Error')}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-500" />
              <CardDescription>
                {t('auth.verifyingEmailDescription') || 'Please wait while we verify your email address...'}
              </CardDescription>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
              <CardDescription className="space-y-3">
                <p>{t('auth.emailVerifiedDescription') || 'Your email has been successfully verified.'}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('auth.canCloseWindow') || 'You can now close this window and sign in to your account.'}
                </p>
              </CardDescription>
              <div className="space-y-2">
                <Button onClick={() => navigate('/sign-in')} className="w-full">
                  {t('common.signIn') || 'Sign In'}
                </Button>
                <Button onClick={() => window.close()} variant="outline" className="w-full">
                  {t('common.closeWindow') || 'Close Window'}
                </Button>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="h-12 w-12 mx-auto text-red-500" />
              <CardDescription className="text-red-600 dark:text-red-400">{errorMessage}</CardDescription>
              <div className="space-y-2">
                <Button onClick={() => navigate('/sign-in')} variant="outline" className="w-full">
                  {t('common.signIn') || 'Sign In'}
                </Button>
                <Button onClick={() => navigate('/sign-up')} className="w-full">
                  {t('common.signUp') || 'Sign Up'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail;
