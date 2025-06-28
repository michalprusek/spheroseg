import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const BackButton: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <Button
      variant="ghost"
      onClick={() => navigate('/')}
      aria-label={t('common.backToHome')}
      className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 flex items-center gap-2 px-3 py-2"
    >
      <ArrowLeft className="h-5 w-5" />
      <span className="text-sm font-medium">{t('navbar.home')}</span>
    </Button>
  );
};

export default BackButton;
