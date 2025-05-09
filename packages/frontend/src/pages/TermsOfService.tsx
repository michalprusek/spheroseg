import React from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const TermsOfService = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 dark:from-gray-800 dark:via-gray-900 dark:to-black">
      <Navbar />
      <div className="container mx-auto px-4 py-12 flex-1 mt-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">{t('termsPage.title')}</h1>

          <div className="prose prose-blue max-w-none">
            <h2 className="text-2xl font-bold mt-6 mb-4">{t('termsPage.acceptance.title')}</h2>
            <p className="mb-4">
              {t('termsPage.acceptance.paragraph1')}
            </p>

            <h2 className="text-2xl font-bold mt-6 mb-4">{t('termsPage.useLicense.title')}</h2>
            <p className="mb-4">
              {t('termsPage.useLicense.paragraph1')}
            </p>

            <h2 className="text-2xl font-bold mt-6 mb-4">{t('termsPage.dataUsage.title')}</h2>
            <p className="mb-4">
              {t('termsPage.dataUsage.paragraph1')}
            </p>

            <h2 className="text-2xl font-bold mt-6 mb-4">{t('termsPage.limitations.title')}</h2>
            <p className="mb-4">
              {t('termsPage.limitations.paragraph1')}
            </p>

            <h2 className="text-2xl font-bold mt-6 mb-4">{t('termsPage.revisions.title')}</h2>
            <p className="mb-4">
              {t('termsPage.revisions.paragraph1')}
            </p>

            <h2 className="text-2xl font-bold mt-6 mb-4">{t('termsPage.governingLaw.title')}</h2>
            <p className="mb-4">
              {t('termsPage.governingLaw.paragraph1')}
            </p>

            <p className="text-sm text-gray-500 mt-8 mb-4">Last Updated: July 1, 2023</p>
          </div>

          <div className="mt-8 flex justify-between">
            <Button variant="outline" asChild>
              <Link to="/">{t('common.backToHome')}</Link>
            </Button>
            <Button asChild>
              <Link to="/privacy-policy">{t('common.privacyPolicyLink')}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
