import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

const PrivacyPolicy = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 dark:from-gray-800 dark:via-gray-900 dark:to-black">
      <Navbar />
      <div className="container mx-auto px-4 py-12 flex-1 mt-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">{t('privacyPage.title')}</h1>

          <div className="prose prose-blue max-w-none">
            <h2 className="text-2xl font-bold mt-6 mb-4">{t('privacyPage.introduction.title')}</h2>
            <p className="mb-4">{t('privacyPage.introduction.paragraph1')}</p>

            <h2 className="text-2xl font-bold mt-6 mb-4">{t('privacyPage.informationWeCollect.title')}</h2>
            <p className="mb-4">{t('privacyPage.informationWeCollect.paragraph1')}</p>

            <h3 className="text-xl font-semibold mt-4 mb-3">{t('privacyPage.personalInformation.title')}</h3>
            <p className="mb-4">{t('privacyPage.personalInformation.paragraph1')}</p>

            <h3 className="text-xl font-semibold mt-4 mb-3">{t('privacyPage.researchData.title')}</h3>
            <p className="mb-4">{t('privacyPage.researchData.paragraph1')}</p>

            <h3 className="text-xl font-semibold mt-4 mb-3">{t('privacyPage.usageInformation.title')}</h3>
            <p className="mb-4">{t('privacyPage.usageInformation.paragraph1')}</p>

            <h2 className="text-2xl font-bold mt-6 mb-4">{t('privacyPage.howWeUse.title')}</h2>
            <p className="mb-4">{t('privacyPage.howWeUse.paragraph1')}</p>

            <h2 className="text-2xl font-bold mt-6 mb-4">{t('privacyPage.dataSecurity.title')}</h2>
            <p className="mb-4">{t('privacyPage.dataSecurity.paragraph1')}</p>

            <h2 className="text-2xl font-bold mt-6 mb-4">{t('privacyPage.dataSharing.title')}</h2>
            <p className="mb-4">{t('privacyPage.dataSharing.paragraph1')}</p>

            <h2 className="text-2xl font-bold mt-6 mb-4">{t('privacyPage.yourChoices.title')}</h2>
            <p className="mb-4">{t('privacyPage.yourChoices.paragraph1')}</p>

            <h2 className="text-2xl font-bold mt-6 mb-4">{t('privacyPage.changes.title')}</h2>
            <p className="mb-4">{t('privacyPage.changes.paragraph1')}</p>

            <h2 className="text-2xl font-bold mt-6 mb-4">{t('privacyPage.contactUs.title')}</h2>
            <p className="mb-4">{t('privacyPage.contactUs.paragraph1')}</p>

            <p className="text-sm text-gray-500 mt-8 mb-4">{t('privacyPage.lastUpdated')}</p>
          </div>

          <div className="mt-8 flex justify-between">
            <Button variant="outline" asChild>
              <Link to="/">{t('common.backToHome')}</Link>
            </Button>
            <Button asChild>
              <Link to="/terms-of-service">{t('common.termsOfServiceLink')}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
