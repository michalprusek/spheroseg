import React from 'react';
import Navbar from '@/components/Navbar';
import ThemedFooter from '@/components/ThemedFooter';
import { Link } from 'react-router-dom';
import { FileText, Code, Info, BookOpen, Microscope, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { constructUrl } from '@/lib/urlUtils';
import { appConfig } from '@/config/app.config';

const Documentation = () => {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 dark:from-gray-800 dark:via-gray-900 dark:to-black">
      <Navbar />
      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="max-w-3xl mx-auto text-center mb-12 md:mb-16">
            <div className="inline-block bg-blue-100 dark:bg-blue-900 px-4 py-2 rounded-full mb-4">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('documentation.tag')}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">{t('documentation.title')}</h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">{t('documentation.subtitle')}</p>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {/* Sidebar */}
            <aside className="lg:col-span-1">
              <div className="sticky top-24 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="font-semibold text-lg mb-4">{t('documentation.sidebar.title')}</h3>
                <nav className="space-y-2">
                  <a
                    href="#introduction"
                    className="flex items-center text-blue-600 dark:text-blue-400 p-2 rounded-md bg-blue-50 dark:bg-blue-900/30"
                  >
                    <Info className="w-4 h-4 mr-2" />
                    {t('documentation.sidebar.introduction')}
                  </a>
                  <a
                    href="#getting-started"
                    className="flex items-center text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    {t('documentation.sidebar.gettingStarted')}
                  </a>
                  <a
                    href="#upload-images"
                    className="flex items-center text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {t('documentation.sidebar.uploadingImages')}
                  </a>
                  <a
                    href="#segmentation"
                    className="flex items-center text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <Microscope className="w-4 h-4 mr-2" />
                    {t('documentation.sidebar.segmentationProcess')}
                  </a>
                  <a
                    href="#api"
                    className="flex items-center text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <Code className="w-4 h-4 mr-2" />
                    {t('documentation.sidebar.apiReference')}
                  </a>
                </nav>
              </div>
            </aside>

            {/* Documentation Content */}
            <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 md:p-8">
              <div className="prose max-w-none">
                <section id="introduction" className="mb-12">
                  <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                    {t('documentation.introduction.title')}
                  </h2>
                  <div className="glass-morphism rounded-xl overflow-hidden p-6 mb-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700">
                    <div className="flex flex-col md:flex-row gap-6 items-center">
                      <div className="md:w-1/3">
                        <img
                          src="/assets/illustrations/documentation-image.png"
                          alt={t('documentation.introduction.imageAlt')}
                          className="rounded-lg shadow-md w-full"
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement;
                            if (img) {
                              console.error('Failed to load documentation image');
                              // Try the first fallback image with new path
                              img.src = '/assets/illustrations/026f6ae6-fa28-487c-8263-f49babd99dd3.png';

                              // Add a second error handler with another fallback
                              img.onerror = () => {
                                console.error('Failed to load first fallback image');
                                img.src = '/assets/illustrations/8f483962-36d5-4bae-8c90-c9542f8cc2d8.png';

                                // Final fallback is our placeholder
                                img.onerror = () => {
                                  console.error('Failed to load all fallback images');
                                  img.src = '/placeholder.svg';
                                  img.onerror = null; // Prevent infinite loop
                                };
                              };
                            }
                          }}
                        />
                      </div>
                      <div className="md:w-2/3">
                        <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">{t('documentation.introduction.whatIs.title')}</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                          {t('documentation.introduction.whatIs.paragraph1')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="mb-4 text-gray-700 dark:text-gray-300">{t('documentation.introduction.whatIs.paragraph2')}</p>

                  <p className="mb-4 text-gray-700 dark:text-gray-300">{t('documentation.introduction.whatIs.paragraph3')}</p>
                </section>

                <section id="getting-started" className="mb-12">
                  <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                    {t('documentation.gettingStarted.title')}
                  </h2>

                  <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
                    {t('documentation.gettingStarted.accountCreation.title')}
                  </h3>
                  <p className="mb-4 text-gray-700 dark:text-gray-300">{t('documentation.gettingStarted.accountCreation.paragraph1')}</p>
                  <ol className="list-decimal pl-6 mb-6 space-y-2 text-gray-700 dark:text-gray-300">
                    <li>
                      {t('documentation.gettingStarted.accountCreation.step1Prefix')}{' '}
                      <Link to="/sign-up" className="text-blue-600 hover:underline">
                        {t('documentation.gettingStarted.accountCreation.step1Link')}
                      </Link>
                    </li>
                    <li>{t('documentation.gettingStarted.accountCreation.step2')}</li>
                    <li>{t('documentation.gettingStarted.accountCreation.step3')}</li>
                    <li>{t('documentation.gettingStarted.accountCreation.step4')}</li>
                  </ol>

                  <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
                    {t('documentation.gettingStarted.creatingProject.title')}
                  </h3>
                  <p className="mb-4 text-gray-700 dark:text-gray-300">{t('documentation.gettingStarted.creatingProject.paragraph1')}</p>
                  <ol className="list-decimal pl-6 mb-6 space-y-2 text-gray-700 dark:text-gray-300">
                    <li>{t('documentation.gettingStarted.creatingProject.step1')}</li>
                    <li>{t('documentation.gettingStarted.creatingProject.step2')}</li>
                    <li>{t('documentation.gettingStarted.creatingProject.step3')}</li>
                    <li>{t('documentation.gettingStarted.creatingProject.step4')}</li>
                  </ol>
                </section>

                <section id="upload-images" className="mb-12">
                  <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                    {t('documentation.uploadingImages.title')}
                  </h2>

                  <p className="mb-4 text-gray-700 dark:text-gray-300">{t('documentation.uploadingImages.paragraph1')}</p>

                  <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">{t('documentation.uploadingImages.methods.title')}</h3>
                  <p className="mb-4 text-gray-700 dark:text-gray-300">{t('documentation.uploadingImages.methods.paragraph1')}</p>
                  <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700 dark:text-gray-300">
                    <li>{t('documentation.uploadingImages.methods.step1')}</li>
                    <li>{t('documentation.uploadingImages.methods.step2')}</li>
                    <li>{t('documentation.uploadingImages.methods.step3')}</li>
                  </ul>

                </section>

                <section id="segmentation" className="mb-12">
                  <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                    {t('documentation.segmentationProcess.title')}
                  </h2>

                  <p className="mb-4 text-gray-700 dark:text-gray-300">{t('documentation.segmentationProcess.paragraph1')}</p>

                  <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
                    {t('documentation.segmentationProcess.automatic.title')}
                  </h3>
                  <p className="mb-4 text-gray-700 dark:text-gray-300">{t('documentation.segmentationProcess.automatic.paragraph1')}</p>
                  <ol className="list-decimal pl-6 mb-6 space-y-2 text-gray-700 dark:text-gray-300">
                    <li>{t('documentation.segmentationProcess.automatic.step1')}</li>
                    <li>{t('documentation.segmentationProcess.automatic.step2')}</li>
                    <li>{t('documentation.segmentationProcess.automatic.step3')}</li>
                    <li>{t('documentation.segmentationProcess.automatic.step4')}</li>
                  </ol>

                  <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">{t('documentation.segmentationProcess.manual.title')}</h3>
                  <p className="mb-4 text-gray-700 dark:text-gray-300">{t('documentation.segmentationProcess.manual.paragraph1')}</p>
                  <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700 dark:text-gray-300">
                    <li>{t('documentation.segmentationProcess.manual.step1')}</li>
                    <li>{t('documentation.segmentationProcess.manual.step2')}</li>
                    <li>{t('documentation.segmentationProcess.manual.step3')}</li>
                    <li>{t('documentation.segmentationProcess.manual.step4')}</li>
                  </ul>
                </section>

                <section id="api" className="mb-12">
                  <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                    {t('documentation.apiReference.title')}
                  </h2>

                  <p className="mb-4 text-gray-700 dark:text-gray-300">{t('documentation.apiReference.paragraph1')}</p>

                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md mb-6">
                    <p className="font-mono text-sm mb-2">GET /api/v1/projects</p>
                    <p className="text-gray-700 dark:text-gray-300 text-sm">
                      {t('documentation.apiReference.endpoint1Desc')}
                    </p>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md mb-6">
                    <p className="font-mono text-sm mb-2">GET /api/v1/projects/:id/images</p>
                    <p className="text-gray-700 dark:text-gray-300 text-sm">
                      {t('documentation.apiReference.endpoint2Desc')}
                    </p>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md mb-6">
                    <p className="font-mono text-sm mb-2">POST /api/v1/images/:id/segment</p>
                    <p className="text-gray-700 dark:text-gray-300 text-sm">
                      {t('documentation.apiReference.endpoint3Desc')}
                    </p>
                  </div>

                  <p className="mb-4 text-gray-700 dark:text-gray-300">
                    {t('documentation.apiReference.contactPrefix')}{' '}
                    <a href={`mailto:${appConfig.contact.developer.email}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                      {appConfig.contact.developer.email}
                    </a>
                    .
                  </p>
                </section>

                <div className="flex justify-between items-center mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Link to="/" className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                    <ArrowRight className="w-4 h-4 mr-2 transform rotate-180" />
                    {t('documentation.backToHome')}
                  </Link>
                  <a href="#introduction" className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                    {t('documentation.backToTop')}
                    <ArrowRight className="w-4 h-4 ml-2 transform -rotate-90" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <ThemedFooter />
    </div>
  );
};

export default Documentation;
