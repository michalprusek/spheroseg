import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import BackButton from '@/components/BackButton';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Loader2 } from "lucide-react";

const ForgotPassword = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error(t('auth.enterEmail'));
      return;
    }
    setIsLoading(true);
    console.log(`Password reset requested for: ${email}`);

    // --- Backend Integration Placeholder ---
    // TODO: Replace with actual API call to backend endpoint for password reset
    // Example: await requestPasswordReset(email);
    // The backend should handle sending the reset link to the user's email.
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      // Assume success for now
      setIsSubmitted(true);
      toast.success(t('auth.passwordResetLinkSent') || 'If an account exists for this email, a password reset link has been sent.');
    } catch (error) {
      console.error("Password reset request error:", error);
      toast.error(t('auth.passwordResetFailed') || 'Failed to send password reset link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 dark:from-gray-800 dark:via-gray-900 dark:to-black">
      {/* Header Buttons */}
      <div className="absolute top-4 left-4">
        <BackButton />
      </div>
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      {/* Main Content Card */}
      <Card className="w-full max-w-md shadow-xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700/50 rounded-lg overflow-hidden">
        <CardHeader className="p-6 text-center">
          <div className="flex justify-center mb-4">
            <Link
              to="/"
              className="inline-flex items-center justify-center mx-auto mb-4"
            >
              <div className="w-12 h-12 rounded-lg bg-blue-500 flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-xl">S</span>
              </div>
            </Link>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t('auth.forgotPasswordTitle')}</h2>
          <p className="text-gray-500 dark:text-gray-400">
            {isSubmitted ? t('auth.checkYourEmail') : t('auth.enterEmailForReset')}
          </p>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          {isSubmitted ? (
            <div className="text-center">
              <p className="text-green-600 dark:text-green-400 mb-4">{t('auth.passwordResetLinkSent')}</p>
              <Button asChild variant="outline" className="rounded-md">
                <Link to="/sign-in">{t('auth.backToSignIn')}</Link>
              </Button>
            </div>
          ) : (
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
              <Button type="submit" className="w-full h-10 text-base font-semibold rounded-md" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('auth.sendingResetLink')}
                  </>
                ) : t('auth.sendResetLink')}
              </Button>
            </form>
          )}
        </CardContent>

        {!isSubmitted && (
          <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700/50 text-center">
            <Button asChild variant="link" className="text-sm">
              <Link to="/sign-in">{t('auth.backToSignIn')}</Link>
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ForgotPassword;
