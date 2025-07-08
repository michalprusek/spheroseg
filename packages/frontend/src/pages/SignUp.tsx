import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import axios from 'axios';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import BackButton from '@/components/BackButton';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useEmailValidation } from '@/hooks/useEmailValidation';

const SignUp = () => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);

  const { t } = useLanguage();
  const emailValidation = useEmailValidation(300);

  type SignUpFormValues = z.infer<typeof formSchema>;

  const formSchema = z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Invalid email address').min(1, 'Email is required'),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    confirmPassword: z.string().min(8, 'Password must be at least 8 characters long'),
    agreeTerms: z.boolean().refine((val) => val, 'You must agree to the terms and conditions'),
  }).refine(
    (data) => data.password === data.confirmPassword,
    {
      message: "Passwords don't match",
      path: ["confirmPassword"],
    }
  );

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      agreeTerms: false,
    },
  });

  // Watch all form fields for real-time validation and button activation
  const emailValue = form.watch('email');
  const passwordValue = form.watch('password');
  const confirmPasswordValue = form.watch('confirmPassword');
  const firstNameValue = form.watch('firstName');
  const lastNameValue = form.watch('lastName');
  const agreeTermsValue = form.watch('agreeTerms');

  // Trigger email validation when email changes
  useEffect(() => {
    if (emailValue) {
      emailValidation.checkEmail(emailValue);
    }
  }, [emailValue, emailValidation.checkEmail]);
  
  // Trigger password confirmation validation when either password changes
  useEffect(() => {
    if (confirmPasswordValue && passwordValue !== confirmPasswordValue) {
      form.setError('confirmPassword', {
        type: 'manual',
        message: "Passwords don't match",
      });
    } else if (confirmPasswordValue && passwordValue === confirmPasswordValue) {
      form.clearErrors('confirmPassword');
    }
  }, [passwordValue, confirmPasswordValue, form]);

  // Determine if form can be submitted
  const passwordsMatch = passwordValue === confirmPasswordValue;
  const hasValidEmail = emailValue && emailValue.includes('@') && emailValue.includes('.');
  const hasMinPasswordLength = passwordValue && passwordValue.length >= 8;
  const allFieldsFilled = firstNameValue && lastNameValue && emailValue && 
                         passwordValue && confirmPasswordValue && agreeTermsValue;
  
  const canSubmit = !emailValidation.exists && 
                   !emailValidation.hasAccessRequest && 
                   !emailValidation.isValidating && 
                   passwordsMatch && 
                   hasValidEmail &&
                   hasMinPasswordLength &&
                   allFieldsFilled;

  const navigate = useNavigate();
  const { signUp, user } = useAuth();

  const onSubmit = async (data: SignUpFormValues) => {
    setError(null);
    setIsLoading(true);

    // Double-check password match before submission
    if (data.password !== data.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const name = `${data.firstName} ${data.lastName}`;
      const success = await signUp(data.email, data.password, name);
      
      if (success) {
        toast.success(t('auth.signUpSuccess') || 'Registration successful!');
        navigate('/sign-in');
      }
    } catch (error: unknown) {
      console.error('Sign up error:', error);
      
      // Check for 409 Conflict (user already exists)
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setError(t('auth.emailAlreadyExists') || 'This email is already registered. Please use a different email or sign in.');
        return; // Don't navigate or show success message
      }
      
      let errorMessage = t('auth.signUpFailed') || 'Registration failed. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="mx-auto max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl">Already Logged In</CardTitle>
            <CardDescription>You are already signed in.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/dashboard">
              <Button className="w-full">Go to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
        <div className="absolute top-[-20px] left-0 right-0 flex justify-between items-center mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label={t('common.backToHome')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <LanguageSwitcher />
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 dark:from-gray-800 dark:via-gray-900 dark:to-black p-4">
        <div className="w-full max-w-md">
          <Card className="shadow-xl rounded-lg overflow-hidden bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/50">
            <CardHeader className="text-center pt-8 pb-4">
              <CardTitle className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                {t('common.signUp')}
              </CardTitle>
              <CardDescription className="text-gray-500 dark:text-gray-400">
                {t('auth.enterInfoCreateAccount') || 'Enter your information to create an account'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <p className="text-gray-500 dark:text-gray-400">{t('auth.signUpSuccess')}</p>
              <Link to="/sign-in" className="underline">
                {t('common.signIn')}
              </Link>
            </CardContent>
          </Card>
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
      <Card className="w-full max-w-md shadow-xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700/50 rounded-lg overflow-hidden">
        <CardHeader className="p-6 pt-9 mt-3 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">{t('auth.signUpTitle')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('auth.signUpDescription')}</p>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.name')}</FormLabel>
                      <FormControl>
                        <Input
                          id="firstName"
                          placeholder={t('auth.firstNamePlaceholder')}
                          {...field}
                          className="h-10 bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 rounded-md"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.lastName') || 'Last name'}</FormLabel>
                      <FormControl>
                        <Input
                          id="lastName"
                          placeholder={t('auth.lastNamePlaceholder')}
                          {...field}
                          className="h-10 bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 rounded-md"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => {
                  const hasEmailError = emailValidation.exists || emailValidation.hasAccessRequest;
                  const inputClassName = `h-10 bg-gray-50 dark:bg-gray-700/50 rounded-md transition-colors ${
                    hasEmailError
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                      : emailValue && !emailValidation.isValidating && !hasEmailError
                      ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`;

                  return (
                    <FormItem>
                      <FormLabel>{t('common.email')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            id="email"
                            type="email"
                            placeholder={t('auth.emailPlaceholder')}
                            {...field}
                            className={inputClassName}
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                            {emailValidation.isValidating && emailValue && (
                              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                            )}
                            {!emailValidation.isValidating && emailValue && hasEmailError && (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                            {!emailValidation.isValidating && emailValue && !hasEmailError && emailValue.includes('@') && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                      {hasEmailError && (
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                          {emailValidation.exists
                            ? t('auth.emailAlreadyExists') || 'This email is already registered. Please use a different email or sign in.'
                            : t('auth.emailHasPendingRequest') || 'This email has a pending access request. Please wait for approval or use a different email.'}
                        </p>
                      )}
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.password')}</FormLabel>
                    <FormControl>
                      <Input
                        id="password"
                        type="password"
                        placeholder={t('auth.passwordPlaceholder')}
                        {...field}
                        className="h-10 bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 rounded-md"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => {
                  const passwordsMatch = passwordValue === confirmPasswordValue && confirmPasswordValue;
                  const passwordsDontMatch = passwordValue !== confirmPasswordValue && confirmPasswordValue;
                  
                  const inputClassName = `h-10 bg-gray-50 dark:bg-gray-700/50 rounded-md transition-colors ${
                    passwordsDontMatch
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                      : passwordsMatch
                      ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`;
                  
                  return (
                    <FormItem>
                      <FormLabel>{t('common.passwordConfirm')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            id="confirmPassword"
                            type="password"
                            placeholder={t('auth.passwordConfirmPlaceholder') || t('auth.passwordPlaceholder')}
                            {...field}
                            className={inputClassName}
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                            {passwordsDontMatch && (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                            {passwordsMatch && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name="agreeTerms"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50">
                    <div className="flex h-5 items-center">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </div>
                    <div className="ml-2 leading-none">
                      <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                        {t('requestAccess.agreeToTerms')}{' '}
                        <Link
                          to="/terms-of-service"
                          className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors underline underline-offset-4"
                        >
                          {t('common.termsOfService')}
                        </Link>{' '}
                        {t('requestAccess.and')}{' '}
                        <Link
                          to="/privacy-policy"
                          className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors underline underline-offset-4"
                        >
                          {t('common.privacyPolicy')}
                        </Link>
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              {error && <p className="text-xs text-red-500">{error}</p>}

              <Button 
                type="submit" 
                className="w-full h-10 text-base font-semibold rounded-md" 
                disabled={isLoading || !canSubmit}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('auth.creatingAccount') || 'Creating Account...'}
                  </>
                ) : (
                  t('common.createAccount')
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700/50">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                {t('auth.alreadyHaveAccount')}
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Link to="/sign-in">
              <Button variant="outline" className="w-full h-10 text-base rounded-md">
                {t('auth.signIn')}
              </Button>
            </Link>
            <Link to="/request-access">
              <Button variant="outline" className="w-full h-10 text-base rounded-md">
                {t('auth.requestAccess')}
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

export default SignUp;
