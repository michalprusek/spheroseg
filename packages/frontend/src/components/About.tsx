import React, { useEffect, useState } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import getAssetUrl from '@/utils/getAssetUrl';
import { appConfig } from '@/config/app.config';

const About = () => {
  const { t } = useTranslations();
  const [forceUpdate, setForceUpdate] = useState(0);

  useEffect(() => {
    console.log(`Language in About component changed`);
    setForceUpdate((prev) => prev + 1);
  }, []);

  return (
    <>
      {/* About Section */}
      <section id="about" className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-block bg-blue-100 dark:bg-blue-900 px-4 py-2 rounded-full mb-4">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('index.about.tag')}</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 dark:text-gray-100">{t('index.about.title')}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center animate-on-scroll">
              <div className="glass-morphism rounded-2xl overflow-hidden">
                <img
                  src={getAssetUrl('assets/illustrations/8f483962-36d5-4bae-8c90-c9542f8cc2d8.png')}
                  alt={t('index.about.imageAlt')}
                  className="w-full h-auto"
                />
              </div>
              <div className="space-y-6">
                <p className="text-gray-600 dark:text-gray-300">{t('index.about.paragraph1')}</p>
                <p className="text-gray-600 dark:text-gray-300">{t('index.about.paragraph2')}</p>
                <p className="text-gray-600 dark:text-gray-300">{t('index.about.paragraph3')}</p>
                <p className="text-gray-600 dark:text-gray-300">
                  <a
                    href={`mailto:${appConfig.contact.email}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {appConfig.contact.email}
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-b from-white to-blue-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center animate-on-scroll">
            <h2 className="text-3xl md:text-4xl font-bold mb-8 dark:text-gray-100">{t('index.cta.title')}</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto">
              {t('index.cta.subtitle')}
            </p>
            <div className="inline-block glass-morphism rounded-xl p-10 shadow-glass-lg dark:bg-gray-800/70">
              <h3 className="text-2xl font-semibold mb-6 dark:text-gray-100">{t('index.cta.boxTitle')}</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">{t('index.cta.boxText')}</p>
              <a
                href="/sign-up"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white py-3 px-8 rounded-md font-medium transition-colors"
              >
                {t('index.cta.button')}
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default About;
