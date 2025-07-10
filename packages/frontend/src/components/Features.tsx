import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Microscope, Share2, LineChart, Upload, Brain } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

// Import translation files directly
import enTranslations from '@/translations/en';
import csTranslations from '@/translations/cs';
import deTranslations from '@/translations/de';
import esTranslations from '@/translations/es';
import frTranslations from '@/translations/fr';
import zhTranslations from '@/translations/zh';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}

const FeatureCard = React.memo(({ icon, title, description, delay }: FeatureCardProps) => (
  <div
    className="glass-morphism p-6 rounded-xl transition-all duration-300 hover:shadow-glass-lg"
    style={{ transitionDelay: `${delay}ms` }}
  >
    <div className="w-14 h-14 mb-6 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">{icon}</div>
    <h3 className="text-xl font-semibold mb-2">{title}</h3>
    <p className="text-gray-600">{description}</p>
  </div>
));

const Features = () => {
  const { language } = useLanguage();
  const featuresRef = useRef<HTMLDivElement>(null);
  const [forceUpdate, setForceUpdate] = useState(0);

  // Force component to re-render when language changes
  useEffect(() => {
    console.log(`Language in Features component changed to: ${language}`);
    setForceUpdate((prev) => prev + 1);
  }, [language]);

  // Get translations directly from the translation files
  const getTranslation = (key: string) => {
    // Split the key into parts (e.g., 'features.title' -> ['features', 'title'])
    const parts = key.split('.');

    // Select the appropriate translation file based on the current language
    let translations;
    switch (language) {
      case 'cs':
        translations = csTranslations;
        break;
      case 'de':
        translations = deTranslations;
        break;
      case 'es':
        translations = esTranslations;
        break;
      case 'fr':
        translations = frTranslations;
        break;
      case 'zh':
        translations = zhTranslations;
        break;
      default:
        translations = enTranslations;
    }

    // Navigate through the translation object to find the value
    let value = translations;
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        // If the key doesn't exist in the current language, fall back to English
        if (language !== 'en') {
          let englishValue = enTranslations;
          for (const p of parts) {
            if (englishValue && typeof englishValue === 'object' && p in englishValue) {
              englishValue = englishValue[p];
            } else {
              return key; // Key not found in English either
            }
          }
          return typeof englishValue === 'string' ? englishValue : key;
        }
        return key; // Key not found
      }
    }

    return typeof value === 'string' ? value : key;
  };

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

    if (featuresRef.current) {
      observer.observe(featuresRef.current);
    }

    return () => {
      if (featuresRef.current) {
        observer.unobserve(featuresRef.current);
      }
    };
  }, []);

  // Log the current translations for debugging
  useEffect(() => {
    console.log('Current features translations:');
    console.log('tag:', getTranslation('features.tag'));
    console.log('title:', getTranslation('features.title'));
    console.log('subtitle:', getTranslation('features.subtitle'));
  }, [language, forceUpdate]);

  const features = [
    {
      icon: <Microscope size={28} />,
      title: getTranslation('features.cards.segmentation.title'),
      description: getTranslation('features.cards.segmentation.description'),
      delay: 100,
    },
    {
      icon: <Brain size={28} />,
      title: getTranslation('features.cards.aiAnalysis.title'),
      description: getTranslation('features.cards.aiAnalysis.description'),
      delay: 200,
    },
    {
      icon: <Upload size={28} />,
      title: getTranslation('features.cards.uploads.title'),
      description: getTranslation('features.cards.uploads.description'),
      delay: 300,
    },
    {
      icon: <LineChart size={28} />,
      title: getTranslation('features.cards.insights.title'),
      description: getTranslation('features.cards.insights.description'),
      delay: 400,
    },
    {
      icon: <Share2 size={28} />,
      title: getTranslation('features.cards.collaboration.title'),
      description: getTranslation('features.cards.collaboration.description'),
      delay: 500,
    },
    {
      icon: <Sparkles size={28} />,
      title: getTranslation('features.cards.pipeline.title'),
      description: getTranslation('features.cards.pipeline.description'),
      delay: 600,
    },
  ];

  return (
    <section id="features" className="py-20 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-background to-transparent -z-10"></div>

      <div ref={featuresRef} className="container mx-auto px-4 staggered-fade-in">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-block bg-blue-100 px-4 py-2 rounded-full mb-4">
            <span className="text-sm font-medium text-blue-700">{getTranslation('features.tag')}</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-6">{getTranslation('features.title')}</h2>
          <p className="text-lg text-gray-600">{getTranslation('features.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              delay={feature.delay}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default React.memo(Features);
