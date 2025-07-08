import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2 } from 'lucide-react';
import BackButton from '@/components/BackButton';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { ArrowLeft } from 'lucide-react'; // Import ArrowLeft

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn, user } = useAuth();
  const { t } = useLanguage(); // Přidáme použití useLanguage

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error(t('auth.fillAllFields'));
      return;
    }

    setIsLoading(true);

    const success = await signIn(email, password, rememberMe);
    setIsLoading(false);
    
    // signIn function already handles error toasts in AuthContext
    // No need to show additional toasts here
  };

  // If already logged in, show a message instead of the form
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full glass-morphism rounded-2xl overflow-hidden shadow-glass-lg p-10 text-center">
          <h2 className="text-2xl font-bold mb-4">{t('auth.alreadyLoggedInTitle')}</h2>
          <p className="mb-6 text-gray-600">{t('auth.alreadyLoggedInMessage')}</p>
          <Button asChild className="w-full">
            <Link to="/dashboard">{t('auth.goToDashboardLink')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 dark:from-gray-800 dark:via-gray-900 dark:to-black">
      {/* Header Buttons - Positioned Absolutely */}
      <div className="absolute top-4 left-4">
        <BackButton />
      </div>
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      {/* Main Content Card - Centered */}
      <div className="w-full max-w-md shadow-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700/60 rounded-lg overflow-hidden">
        <div className="p-6 pt-9 mt-3 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">{t('auth.signInTitle')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{t('auth.signInDescription')}</p>
        </div>
        <div className="p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.emailAddressLabel')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 rounded-md"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t('auth.passwordLabel')}</Label>
              </div>
              <Input
                id="password"
                type="password"
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 rounded-md"
                required
              />
              <Link
                to="/forgot-password"
                className="text-sm text-blue-600 hover:underline dark:text-blue-400 font-medium"
              >
                {t('auth.forgotPasswordLink')}
              </Link>
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex items-center h-5">
                <Checkbox 
                  id="remember" 
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
              </div>
              <div className="ml-2">
                <Label
                  htmlFor="remember"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  {t('auth.rememberMe')}
                </Label>
              </div>
            </div>

            <Button type="submit" className="w-full h-10 text-base font-semibold rounded-md" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('auth.signingIn')}
                </>
              ) : (
                t('auth.signIn')
              )}
            </Button>
          </form>
        </div>
        <div className="p-6 bg-gray-50 dark:bg-gray-800/70 border-t border-gray-100 dark:border-gray-700/50">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-300">
                {t('auth.dontHaveAccount')}
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Link to="/sign-up">
              <Button variant="outline" className="w-full h-10 text-base rounded-md">
                {t('auth.signUp')}
              </Button>
            </Link>
            <Link to="/request-access">
              <Button variant="outline" className="w-full h-10 text-base rounded-md">
                {t('auth.requestAccess')}
              </Button>
            </Link>
            <p className="text-center text-sm text-gray-600 mt-3">
              {t('auth.termsAndPrivacy')}{' '}
              <Link
                to="/terms-of-service"
                className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                {t('common.termsOfService')}
              </Link>{' '}
              {t('requestAccess.and')}{' '}
              <Link
                to="/privacy-policy"
                className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                {t('common.privacyPolicy')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
