import React from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from '@/components/Navbar';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Mail, GitHub, Twitter } from 'lucide-react';

const AboutPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <Container className="py-12">
        <h1 className="text-4xl font-bold mb-8">{t('about.title')}</h1>
        
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">{t('about.mission.title')}</h2>
          <p className="text-lg mb-4">
            {t('about.mission.description')}
          </p>
          <p className="text-lg">
            {t('about.mission.vision')}
          </p>
        </section>
        
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">{t('about.technology.title')}</h2>
          <p className="text-lg mb-4">
            {t('about.technology.description')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="p-6 border rounded-lg">
              <h3 className="text-xl font-medium mb-2">{t('about.technology.feature1.title')}</h3>
              <p>{t('about.technology.feature1.description')}</p>
            </div>
            <div className="p-6 border rounded-lg">
              <h3 className="text-xl font-medium mb-2">{t('about.technology.feature2.title')}</h3>
              <p>{t('about.technology.feature2.description')}</p>
            </div>
            <div className="p-6 border rounded-lg">
              <h3 className="text-xl font-medium mb-2">{t('about.technology.feature3.title')}</h3>
              <p>{t('about.technology.feature3.description')}</p>
            </div>
          </div>
        </section>
        
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">{t('about.team.title')}</h2>
          <p className="text-lg mb-8">
            {t('about.team.description')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-32 h-32 rounded-full bg-gray-200 mx-auto mb-4"></div>
              <h3 className="text-xl font-medium">{t('about.team.member1.name')}</h3>
              <p className="text-muted-foreground">{t('about.team.member1.role')}</p>
            </div>
            <div className="text-center">
              <div className="w-32 h-32 rounded-full bg-gray-200 mx-auto mb-4"></div>
              <h3 className="text-xl font-medium">{t('about.team.member2.name')}</h3>
              <p className="text-muted-foreground">{t('about.team.member2.role')}</p>
            </div>
            <div className="text-center">
              <div className="w-32 h-32 rounded-full bg-gray-200 mx-auto mb-4"></div>
              <h3 className="text-xl font-medium">{t('about.team.member3.name')}</h3>
              <p className="text-muted-foreground">{t('about.team.member3.role')}</p>
            </div>
          </div>
        </section>
        
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">{t('about.contact.title')}</h2>
          <p className="text-lg mb-6">
            {t('about.contact.description')}
          </p>
          <div className="flex flex-col md:flex-row gap-4">
            <Button asChild variant="outline" className="flex items-center gap-2">
              <a href="mailto:contact@spheroseg.com">
                <Mail className="h-4 w-4" />
                {t('about.contact.email')}
              </a>
            </Button>
            <Button asChild variant="outline" className="flex items-center gap-2">
              <a href="https://github.com/spheroseg" target="_blank" rel="noopener noreferrer">
                <GitHub className="h-4 w-4" />
                {t('about.contact.github')}
              </a>
            </Button>
            <Button asChild variant="outline" className="flex items-center gap-2">
              <a href="https://twitter.com/spheroseg" target="_blank" rel="noopener noreferrer">
                <Twitter className="h-4 w-4" />
                {t('about.contact.twitter')}
              </a>
            </Button>
          </div>
        </section>
      </Container>
      
      <footer className="bg-muted py-8">
        <Container>
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-muted-foreground mb-4 md:mb-0">
              © 2023 Spheroid Segmentation Platform
            </p>
            <div className="flex gap-6">
              <Link to="/privacy" className="text-muted-foreground hover:text-foreground">
                {t('common.privacyPolicy')}
              </Link>
              <Link to="/terms" className="text-muted-foreground hover:text-foreground">
                {t('common.termsOfService')}
              </Link>
            </div>
          </div>
        </Container>
      </footer>
    </div>
  );
};

export default AboutPage;
