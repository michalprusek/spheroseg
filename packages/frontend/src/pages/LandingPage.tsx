import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { ArrowRight, Check, Users, BarChart, Layers } from 'lucide-react';

const LandingPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="border-b">
        <Container>
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-6">
              <Link to="/" className="text-xl font-bold">
                SpheroSeg
              </Link>
              <nav className="hidden md:flex gap-6">
                <Link to="/" className="text-sm font-medium hover:text-primary">
                  {t('nav.home')}
                </Link>
                <Link to="/about" className="text-sm font-medium hover:text-primary">
                  {t('nav.about')}
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              <Link to="/signin">
                <Button variant="ghost" size="sm">
                  {t('auth.signIn')}
                </Button>
              </Link>
              <Link to="/signup">
                <Button size="sm">
                  {t('auth.signUp')}
                </Button>
              </Link>
            </div>
          </div>
        </Container>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32">
        <Container>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6 dark:text-white dark:drop-shadow-sm">
                {t('landing.hero.title')}
              </h1>
              <p className="text-xl text-muted-foreground dark:text-gray-300 mb-8">
                {t('landing.hero.subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/signup">
                  <Button size="lg" className="w-full sm:w-auto">
                    {t('landing.hero.getStarted')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/request-access">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    {t('landing.hero.requestAccess')}
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative h-[300px] md:h-[400px] bg-muted rounded-lg overflow-hidden">
              {/* Placeholder for hero image */}
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                {t('landing.hero.imageAlt')}
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted">
        <Container>
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">{t('landing.features.title')}</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('landing.features.subtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-background p-8 rounded-lg">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
                <Layers className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{t('landing.features.feature1.title')}</h3>
              <p className="text-muted-foreground">
                {t('landing.features.feature1.description')}
              </p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-primary mr-2" />
                  <span>{t('landing.features.feature1.point1')}</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-primary mr-2" />
                  <span>{t('landing.features.feature1.point2')}</span>
                </li>
              </ul>
            </div>
            <div className="bg-background p-8 rounded-lg">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
                <BarChart className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{t('landing.features.feature2.title')}</h3>
              <p className="text-muted-foreground">
                {t('landing.features.feature2.description')}
              </p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-primary mr-2" />
                  <span>{t('landing.features.feature2.point1')}</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-primary mr-2" />
                  <span>{t('landing.features.feature2.point2')}</span>
                </li>
              </ul>
            </div>
            <div className="bg-background p-8 rounded-lg">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{t('landing.features.feature3.title')}</h3>
              <p className="text-muted-foreground">
                {t('landing.features.feature3.description')}
              </p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-primary mr-2" />
                  <span>{t('landing.features.feature3.point1')}</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-primary mr-2" />
                  <span>{t('landing.features.feature3.point2')}</span>
                </li>
              </ul>
            </div>
          </div>
        </Container>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <Container>
          <div className="bg-primary text-primary-foreground p-8 md:p-12 rounded-lg text-center">
            <h2 className="text-3xl font-bold mb-4">{t('landing.cta.title')}</h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
              {t('landing.cta.description')}
            </p>
            <Link to="/signup">
              <Button size="lg" variant="secondary">
                {t('landing.cta.button')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Container>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <Container>
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-6 md:mb-0">
              <p className="text-sm text-muted-foreground">
                © 2023 Spheroid Segmentation Platform
              </p>
            </div>
            <div className="flex gap-8">
              <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
                {t('common.privacyPolicy')}
              </Link>
              <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground">
                {t('common.termsOfService')}
              </Link>
            </div>
          </div>
        </Container>
      </footer>
    </div>
  );
};

export default LandingPage;
