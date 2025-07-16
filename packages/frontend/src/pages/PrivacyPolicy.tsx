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

            <h2 className="text-2xl font-bold mt-6 mb-4">{t('privacyPage.dataCollection.title')}</h2>
            <p className="mb-4">{t('privacyPage.dataCollection.paragraph1')}</p>
            {t('privacyPage.dataCollection.list') && Array.isArray(t('privacyPage.dataCollection.list')) && (
              <ul className="list-disc list-inside mb-4">
                {(t('privacyPage.dataCollection.list') as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            )}

            <h2 className="text-2xl font-bold mt-6 mb-4">{t('privacyPage.dataUsage.title')}</h2>
            <p className="mb-4">{t('privacyPage.dataUsage.paragraph1')}</p>
            {t('privacyPage.dataUsage.list') && Array.isArray(t('privacyPage.dataUsage.list')) && (
              <ul className="list-disc list-inside mb-4">
                {(t('privacyPage.dataUsage.list') as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            )}

            <h2 className="text-2xl font-bold mt-6 mb-4">{t('privacyPage.dataStorage.title')}</h2>
            <p className="mb-4">{t('privacyPage.dataStorage.paragraph1')}</p>
            <p className="mb-4">{t('privacyPage.dataStorage.paragraph2')}</p>

            <h2 className="text-2xl font-bold mt-6 mb-4">{t('privacyPage.dataSharing.title')}</h2>
            <p className="mb-4">{t('privacyPage.dataSharing.paragraph1')}</p>

            <h2 className="text-2xl font-bold mt-6 mb-4">{t('privacyPage.userRights.title')}</h2>
            <p className="mb-4">{t('privacyPage.userRights.paragraph1')}</p>
            {t('privacyPage.userRights.list') && Array.isArray(t('privacyPage.userRights.list')) && (
              <ul className="list-disc list-inside mb-4">
                {(t('privacyPage.userRights.list') as string[]).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            )}

            <h2 className="text-2xl font-bold mt-6 mb-4">{t('privacyPage.cookies.title')}</h2>
            <p className="mb-4">{t('privacyPage.cookies.paragraph1')}</p>

            <h2 className="text-2xl font-bold mt-6 mb-4">{t('privacyPage.changes.title')}</h2>
            <p className="mb-4">{t('privacyPage.changes.paragraph1')}</p>

            <h2 className="text-2xl font-bold mt-6 mb-4">{t('privacyPage.contact.title')}</h2>
            <p className="mb-4">{t('privacyPage.contact.paragraph1')}</p>
            <p className="mb-4">
              <a href={`mailto:${t('privacyPage.contact.email')}`} className="text-blue-600 hover:underline">
                {t('privacyPage.contact.email')}
              </a>
            </p>

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
