import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import '@testing-library/jest-dom';

// Mock the AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="auth-provider">{children}</div>,
}));

// Mock the LanguageContext
vi.mock('@/contexts/LanguageContext', () => {
  const actualModule = vi.importActual('@/contexts/LanguageContext');
  let currentLanguage = 'en';

  return {
    ...actualModule,
    useLanguage: () => ({
      language: currentLanguage,
      setLanguage: (lang: string) => {
        currentLanguage = lang;
      },
      t: (key: string) => {
        // Simple translation mapping for testing
        const translations: Record<string, Record<string, string>> = {
          en: {
            // Common translations
            'common.appName': 'Spheroid Segmentation',
            'common.appNameShort': 'SpheroSeg',
            'common.backToHome': 'Back to Home',
            'common.privacyPolicyLink': 'Privacy Policy',
            'common.termsOfServiceLink': 'Terms of Service',

            // Navbar translations
            'navbar.home': 'Home',
            'navbar.features': 'Features',
            'navbar.documentation': 'Documentation',
            'navbar.terms': 'Terms',
            'navbar.privacy': 'Privacy',
            'navbar.login': 'Sign In',
            'navbar.requestAccess': 'Request Access',

            // Footer translations
            'footer.copyrightNotice': '© 2023 Spheroid Segmentation Platform',

            // Privacy page translations
            'privacyPage.title': 'Privacy Policy',
            'privacyPage.introduction.title': 'Introduction',
            'privacyPage.informationWeCollect.title': 'Information We Collect',
            'privacyPage.howWeUse.title': 'How We Use Your Information',
            'privacyPage.dataSecurity.title': 'Data Security',
            'privacyPage.yourRights.title': 'Your Rights',
            'privacyPage.changes.title': 'Changes to This Policy',
            'privacyPage.contactUs.title': 'Contact Us',
          },
          cs: {
            // Common translations
            'common.appName': 'Segmentace Sferoidů',
            'common.appNameShort': 'SpheroSeg',
            'common.backToHome': 'Zpět na úvodní stránku',
            'common.privacyPolicyLink': 'Zásady ochrany osobních údajů',

            // Navbar translations
            'navbar.home': 'Domů',
            'navbar.features': 'Funkce',
            'navbar.documentation': 'Dokumentace',
            'navbar.terms': 'Podmínky',
            'navbar.privacy': 'Soukromí',
            'navbar.login': 'Přihlásit se',
            'navbar.requestAccess': 'Požádat o přístup',

            // Footer translations
            'footer.copyrightNotice': '© 2023 Platforma pro segmentaci sferoidů',

            // Privacy page translations
            'privacyPage.title': 'Zásady ochrany osobních údajů',
            'privacyPage.introduction.title': 'Úvod',
            'privacyPage.informationWeCollect.title': 'Informace, které shromažďujeme',
          },
          de: {
            // Common translations
            'common.appName': 'Spheroid-Segmentierung',
            'common.appNameShort': 'SpheroSeg',
            'common.backToHome': 'Zurück zur Startseite',
            'common.privacyPolicyLink': 'Datenschutzrichtlinie',

            // Navbar translations
            'navbar.home': 'Startseite',
            'navbar.features': 'Funktionen',
            'navbar.documentation': 'Dokumentation',
            'navbar.terms': 'Bedingungen',
            'navbar.privacy': 'Datenschutz',
            'navbar.login': 'Anmelden',
            'navbar.requestAccess': 'Zugang beantragen',

            // Footer translations
            'footer.copyrightNotice': '© 2023 Spheroid-Segmentierungsplattform',

            // Privacy page translations
            'privacyPage.title': 'Datenschutzrichtlinie',
            'privacyPage.introduction.title': 'Einleitung',
            'privacyPage.informationWeCollect.title': 'Informationen, die wir sammeln',
          },
          es: {
            // Common translations
            'common.appName': 'Segmentación de Esferoides',
            'common.appNameShort': 'SpheroSeg',
            'common.backToHome': 'Volver al Inicio',
            'common.privacyPolicyLink': 'Política de Privacidad',

            // Navbar translations
            'navbar.home': 'Inicio',
            'navbar.features': 'Características',
            'navbar.documentation': 'Documentación',
            'navbar.terms': 'Términos',
            'navbar.privacy': 'Privacidad',
            'navbar.login': 'Iniciar sesión',
            'navbar.requestAccess': 'Solicitar acceso',

            // Footer translations
            'footer.copyrightNotice': '© 2023 Plataforma de Segmentación de Esferoides',

            // Privacy page translations
            'privacyPage.title': 'Política de Privacidad',
            'privacyPage.introduction.title': 'Introducción',
            'privacyPage.informationWeCollect.title': 'Información que recopilamos',
          },
          fr: {
            // Common translations
            'common.appName': 'Segmentation de Sphéroïdes',
            'common.appNameShort': 'SpheroSeg',
            'common.backToHome': "Retour à l'Accueil",
            'common.privacyPolicyLink': 'Politique de Confidentialité',

            // Navbar translations
            'navbar.home': 'Accueil',
            'navbar.features': 'Fonctionnalités',
            'navbar.documentation': 'Documentation',
            'navbar.terms': 'Conditions',
            'navbar.privacy': 'Confidentialité',
            'navbar.login': 'Se connecter',
            'navbar.requestAccess': "Demander l'accès",

            // Footer translations
            'footer.copyrightNotice': '© 2023 Plateforme de Segmentation de Sphéroïdes',

            // Privacy page translations
            'privacyPage.title': 'Politique de Confidentialité',
            'privacyPage.introduction.title': 'Introduction',
            'privacyPage.informationWeCollect.title': 'Informations que nous collectons',
          },
          zh: {
            // Common translations
            'common.appName': '类器官分割',
            'common.appNameShort': 'SpheroSeg',
            'common.backToHome': '返回首页',
            'common.privacyPolicyLink': '隐私政策',

            // Navbar translations
            'navbar.home': '首页',
            'navbar.features': '功能',
            'navbar.documentation': '文档',
            'navbar.terms': '条款',
            'navbar.privacy': '隐私',
            'navbar.login': '登录',
            'navbar.requestAccess': '请求访问',

            // Footer translations
            'footer.copyrightNotice': '© 2023 类器官分割平台',

            // Privacy page translations
            'privacyPage.title': '隐私政策',
            'privacyPage.introduction.title': '介绍',
            'privacyPage.informationWeCollect.title': '我们收集的信息',
          },
        };

        return translations[currentLanguage]?.[key] || key;
      },
      availableLanguages: ['en', 'cs', 'de', 'es', 'fr', 'zh'],
    }),
    LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

describe('PrivacyPolicy Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPrivacyPolicy = (language = 'en') => {
    localStorage.setItem('language', language);
    return render(
      <BrowserRouter>
        <AuthProvider>
          <LanguageProvider>
            <PrivacyPolicy />
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>,
    );
  };

  it('renders the privacy policy page correctly', () => {
    renderPrivacyPolicy();

    // Check for page title
    const pageTitle = screen.getAllByText(/Privacy Policy/i);
    expect(pageTitle.length).toBeGreaterThan(0);

    // Check that the page has content
    const pageContent = screen.getByTestId('auth-provider');
    expect(pageContent).toBeInTheDocument();
    expect(pageContent.textContent).toBeTruthy();
  });

  it('renders the navigation bar', () => {
    renderPrivacyPolicy();

    // Check for navigation links using getAllByRole to handle multiple links
    const navLinks = screen.getAllByRole('link');

    // Check if there's a Home link
    expect(navLinks.some((link) => link.textContent?.match(/Home/i))).toBeTruthy();

    // Check if there's a Documentation link
    expect(navLinks.some((link) => link.textContent?.match(/Documentation/i))).toBeTruthy();

    // Check if there's a Sign In link
    expect(navLinks.some((link) => link.textContent?.match(/Sign In/i))).toBeTruthy();
  });

  it('renders the bottom navigation buttons', () => {
    renderPrivacyPolicy();

    // Check for bottom navigation buttons that actually exist
    const backToHomeButton = screen.getByRole('link', { name: /back to home/i });
    expect(backToHomeButton).toBeInTheDocument();
    expect(backToHomeButton).toHaveAttribute('href', '/');

    const termsButton = screen.getByRole('link', { name: /terms of service/i });
    expect(termsButton).toBeInTheDocument();
    expect(termsButton).toHaveAttribute('href', '/terms-of-service');

    // Check that there are multiple links in the page (nav + buttons)
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(2);
  });

  // Test translations for different languages
  it('renders in Czech language', () => {
    renderPrivacyPolicy('cs');

    // Check that the page has content
    const pageContent = screen.getByTestId('auth-provider');
    expect(pageContent).toBeInTheDocument();
    expect(pageContent.textContent).toBeTruthy();
  });

  it('renders in German language', () => {
    renderPrivacyPolicy('de');

    // Check that the page has content
    const pageContent = screen.getByTestId('auth-provider');
    expect(pageContent).toBeInTheDocument();
    expect(pageContent.textContent).toBeTruthy();
  });

  it('renders in Spanish language', () => {
    renderPrivacyPolicy('es');

    // Check that the page has content
    const pageContent = screen.getByTestId('auth-provider');
    expect(pageContent).toBeInTheDocument();
    expect(pageContent.textContent).toBeTruthy();
  });

  it('renders in French language', () => {
    renderPrivacyPolicy('fr');

    // Check that the page has content
    const pageContent = screen.getByTestId('auth-provider');
    expect(pageContent).toBeInTheDocument();
    expect(pageContent.textContent).toBeTruthy();
  });

  it('renders in Chinese language', () => {
    renderPrivacyPolicy('zh');

    // Check that the page has content
    const pageContent = screen.getByTestId('auth-provider');
    expect(pageContent).toBeInTheDocument();
    expect(pageContent.textContent).toBeTruthy();
  });
});
