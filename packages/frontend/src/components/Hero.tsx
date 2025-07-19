import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';
import getAssetUrl from '@/utils/getAssetUrl';

const Hero = () => {
  const { t } = useTranslations();
  const heroRef = useRef<HTMLDivElement>(null);
  const [_forceUpdate, _setForceUpdate] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
          }
        });
      },
      { threshold: 0.1 },
    );

    const currentRef = heroRef.current;

    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  useEffect(() => {
    console.log('Current hero translations:');
    console.log('platformTag:', t('hero.platformTag'));
    console.log('title:', t('hero.title'));
    console.log('subtitle:', t('hero.subtitle'));
    console.log('getStartedButton:', t('hero.getStartedButton'));
    console.log('learnMoreButton:', t('hero.learnMoreButton'));
  }, [t, forceUpdate]);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background elements */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-blue-200/30 rounded-full filter blur-3xl animate-float" />
        <div
          className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-blue-300/20 rounded-full filter blur-3xl animate-float"
          style={{ animationDelay: '-2s' }}
        />
        <div
          className="absolute top-2/3 left-1/3 w-40 h-40 bg-blue-400/20 rounded-full filter blur-3xl animate-float"
          style={{ animationDelay: '-4s' }}
        />
      </div>

      <div ref={heroRef} className="container mx-auto px-4 py-20 staggered-fade-in">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-block glass bg-white/70 dark:bg-black/50 backdrop-blur-lg px-4 py-2 rounded-full mb-4">
            <span className="text-sm font-medium text-blue-600">{t('hero.platformTag')}</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
            {t('hero.title')}
          </h1>

          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">{t('hero.subtitle')}</p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button asChild size="lg" className="rounded-md text-base px-8 py-6">
              <Link to="/sign-up">
                {t('hero.getStartedButton')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-md text-base px-8 py-6">
              <a href="#features">{t('hero.learnMoreButton')}</a>
            </Button>
          </div>

          <div className="pt-12 pb-8 max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="relative glass bg-white/70 dark:bg-black/50 backdrop-blur-lg rounded-2xl shadow-soft overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10"></div>
                <img
                  src={getAssetUrl('assets/illustrations/026f6ae6-fa28-487c-8263-f49babd99dd3.png')}
                  alt={t('hero.imageAlt1')}
                  className="w-full h-auto rounded-2xl transform hover:scale-[1.01] transition-transform duration-500"
                />
              </div>
              <div className="relative glass bg-white/70 dark:bg-black/50 backdrop-blur-lg rounded-2xl shadow-soft overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10"></div>
                <img
                  src={getAssetUrl('assets/illustrations/19687f60-a78f-49e3-ada7-8dfc6a5fab4e.png')}
                  alt={t('hero.imageAlt2')}
                  className="w-full h-auto rounded-2xl transform hover:scale-[1.01] transition-transform duration-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
