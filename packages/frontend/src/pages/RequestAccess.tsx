import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import apiClient from '@/lib/apiClient';
import axios, { AxiosError } from 'axios';
import BackButton from '@/components/BackButton';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useEmailValidation } from '@/hooks/useEmailValidation';
import { appConfig } from '@/config/app.config';

const RequestAccess = () => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { t } = useLanguage();
  const emailValidation = useEmailValidation(300);

  // Trigger email validation when email changes
  useEffect(() => {
    if (email) {
      emailValidation.checkEmail(email);
    }
  }, [email, emailValidation.checkEmail]);

  // Determine if form can be submitted
  // If email validation fails/errors, don't block submission - just check basic form validity
  const canSubmit =
    email &&
    name &&
    reason &&
    !emailValidation.exists &&
    !emailValidation.hasAccessRequest &&
    !emailValidation.isValidating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !name || !reason) {
      toast.error(t('requestAccess.fillRequired') || 'Please fill in all required fields (Email, Name, Reason)');
      return;
    }

    setIsSubmitting(true);

    const requestData = {
      email,
      name,
      organization: organization || null,
      reason,
    };

    console.log(`Sending access request email to ${appConfig.contact.email} with data:`, requestData);

    try {
      await apiClient.post('/api/access-requests', requestData);

      toast.success(t('requestAccess.submitSuccess') || 'Request submitted successfully!');
      setEmail('');
      setName('');
      setOrganization('');
      setReason('');
      setSubmitted(true);
    } catch (error: unknown) {
      console.error('Error submitting access request:', error);
      let errorMessage = t('requestAccess.submitError') || 'Failed to submit request.';

      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data?.message || errorMessage;
        if (error.response.status === 409) {
          errorMessage = t('requestAccess.alreadyPending') || 'An access request for this email is already pending.';
        }
        if (error.response.status === 400 && error.response.data?.errors) {
          const validationErrors = error.response.data.errors
            .map((err: { path: string; message: string }) => `${err.path}: ${err.message}`)
            .join('; ');
          errorMessage = `${t('common.validationFailed')}: ${validationErrors}`;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

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
      <Card className="w-full max-w-md shadow-xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700/50 rounded-lg overflow-hidden">
        {/* Adjusted Header Structure */}
        <CardHeader className="p-6 pt-9 mt-3 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">{t('requestAccess.title')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('requestAccess.description')}</p>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          {submitted ? (
            <div className="text-center py-8 space-y-4">
              <svg className="mx-auto h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-lg font-medium dark:text-white">{t('requestAccess.thankYou')}</h3>
              <p className="text-gray-500 dark:text-gray-400">{t('requestAccess.weWillContact')}</p>
              <Button asChild className="mt-4 rounded-md">
                <Link to="/">{t('common.back')}</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-medium text-gray-700 dark:text-gray-300">
                  {t('requestAccess.emailLabel')} <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('requestAccess.emailPlaceholder')}
                    required
                    className={`h-10 bg-gray-50 dark:bg-gray-700/50 rounded-md transition-colors pr-10 ${
                      emailValidation.exists || emailValidation.hasAccessRequest
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : email &&
                            !emailValidation.isValidating &&
                            !emailValidation.exists &&
                            !emailValidation.hasAccessRequest
                          ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                          : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    {emailValidation.isValidating && email && (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    )}
                    {!emailValidation.isValidating &&
                      email &&
                      (emailValidation.exists || emailValidation.hasAccessRequest) && (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                    {!emailValidation.isValidating &&
                      email &&
                      !emailValidation.exists &&
                      !emailValidation.hasAccessRequest &&
                      email.includes('@') && <CheckCircle className="h-4 w-4 text-green-500" />}
                  </div>
                </div>
                {(emailValidation.exists || emailValidation.hasAccessRequest) && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {emailValidation.exists
                      ? t('auth.emailAlreadyExists') || 'This email is already registered. Please sign in instead.'
                      : t('auth.emailHasPendingRequest') ||
                        'This email already has a pending access request. Please wait for approval.'}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="font-medium text-gray-700 dark:text-gray-300">
                  {t('requestAccess.nameLabel')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('requestAccess.namePlaceholder')}
                  required
                  className="h-10 bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 rounded-md"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="organization" className="font-medium text-gray-700 dark:text-gray-300">
                  {t('requestAccess.institutionLabel')}
                </Label>
                <Input
                  id="organization"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder={t('requestAccess.institutionPlaceholder')}
                  className="h-10 bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 rounded-md"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason" className="font-medium text-gray-700 dark:text-gray-300">
                  {t('requestAccess.reasonLabel')} <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('requestAccess.reasonPlaceholder')}
                  rows={4}
                  required
                  className="min-h-[100px] bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 rounded-md"
                />
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('requestAccess.agreeToTerms')}{' '}
                <Link to="/terms-of-service" className="text-blue-600 hover:underline dark:text-blue-400 font-bold">
                  {t('common.termsOfService')}
                </Link>{' '}
                {t('requestAccess.and')}{' '}
                <Link to="/privacy-policy" className="text-blue-600 hover:underline dark:text-blue-400 font-bold">
                  {t('common.privacyPolicy')}
                </Link>
              </p>

              <Button
                type="submit"
                className="w-full h-10 text-base font-semibold rounded-md"
                disabled={isSubmitting || !canSubmit}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('requestAccess.submittingRequest')}
                  </>
                ) : (
                  t('requestAccess.submitRequest')
                )}
              </Button>
            </form>
          )}
        </CardContent>

        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700/50">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                {t('auth.alreadyHaveAccess')}
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Link to="/sign-in">
              <Button variant="outline" className="w-full h-10 text-base rounded-md">
                {t('auth.signIn')}
              </Button>
            </Link>
            <Link to="/sign-up">
              <Button variant="outline" className="w-full h-10 text-base rounded-md">
                {t('auth.signUp')}
              </Button>
            </Link>
            <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-3">
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
      </Card>
    </div>
  );
};

export default RequestAccess;
