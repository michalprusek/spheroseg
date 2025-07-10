import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import AuthFormLayout from '@/shared/components/auth/AuthFormLayout';
import { EmailField, PasswordField, SubmitButton } from '@/utils/validation/components';
import { useSignInForm } from '@/shared/hooks/useAuthForm';

const SignInForm: React.FC = () => {
  const { t } = useTranslation();
  const { form, isLoading, onSubmit } = useSignInForm();

  // Create footer with sign up and forgot password links
  const footer = (
    <>
      <div className="text-sm text-center">
        <span>{t('auth.noAccount')} </span>
        <Button variant="link" className="p-0" asChild>
          <Link to="/signup">{t('auth.signUp')}</Link>
        </Button>
      </div>
      <div className="text-sm text-center">
        <Button variant="link" className="p-0" asChild>
          <Link to="/forgot-password">{t('auth.forgotPassword')}</Link>
        </Button>
      </div>
    </>
  );

  return (
    <AuthFormLayout title={t('auth.signInTitle')} description={t('auth.signInDescription')} footer={footer}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <EmailField form={form} />
          <PasswordField form={form} />
          <SubmitButton isLoading={isLoading} text={t('auth.signIn')} loadingText={t('common.loading')} />
        </form>
      </Form>
    </AuthFormLayout>
  );
};

export default SignInForm;
