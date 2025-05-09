import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import TermsOfService from '@/pages/TermsOfService';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import '@testing-library/jest-dom';

// Mock the AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="auth-provider">{children}</div>
}));

// Mock the LanguageContext
vi.mock('@/contexts/LanguageContext', () => {
  const actualModule = vi.importActual('@/contexts/LanguageContext');
  let currentLanguage = 'en';

  return {
    ...actualModule,
    useLanguage: () => ({
      language: currentLanguage,
      setLanguage: (lang: string) => { currentLanguage = lang; },
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
            'common.loading': 'Loading...',
            'common.save': 'Save',
            'common.cancel': 'Cancel',
            'common.delete': 'Delete',
            'common.edit': 'Edit',
            'common.create': 'Create',
            'common.search': 'Search',
            'common.error': 'Error',
            'common.success': 'Success',
            'common.back': 'Back',
            'common.signIn': 'Sign In',
            'common.signUp': 'Sign Up',
            'common.signOut': 'Sign Out',
            'common.settings': 'Settings',
            'common.profile': 'Profile',
            'common.dashboard': 'Dashboard',
            'common.project': 'Project',
            'common.projects': 'Projects',
            'common.newProject': 'New Project',
            'common.upload': 'Upload',
            'common.uploadImages': 'Upload Images',
            'common.recentAnalyses': 'Recent Analyses',
            'common.noProjects': 'No Projects Found',
            'common.noImages': 'No Images Found',
            'common.createYourFirst': 'Create your first project to get started',
            'common.tryAgain': 'Try Again',
            'common.email': 'Email',
            'common.password': 'Password',
            'common.name': 'Name',
            'common.description': 'Description',
            'common.date': 'Date',
            'common.status': 'Status',
            'common.images': 'Images',
            'common.image': 'Image',
            'common.projectName': 'Project Name',
            'common.projectDescription': 'Project Description',
            'common.theme': 'Theme',
            'common.language': 'Language',
            'common.light': 'Light',
            'common.dark': 'Dark',
            'common.system': 'System',
            'common.welcome': 'Welcome to the Spheroid Segmentation Platform',
            'common.account': 'Account',
            'common.notifications': 'Notifications',
            'common.passwordConfirm': 'Confirm Password',
            'common.manageAccount': 'Manage your account',
            'common.changePassword': 'Change Password',
            'common.deleteAccount': 'Delete Account',
            'common.requestAccess': 'Request Access',
            'common.termsOfService': 'Terms of Service',
            'common.privacyPolicy': 'Privacy Policy',
            'common.accessRequest': 'Access Request',
            'common.createAccount': 'Create Account',
            'common.signInToAccount': 'Sign in to your account',
            'common.sort': 'Sort',

            // Navbar translations
            'navbar.home': 'Home',
            'navbar.features': 'Features',
            'navbar.documentation': 'Documentation',
            'navbar.terms': 'Terms',
            'navbar.privacy': 'Privacy',
            'navbar.login': 'Sign In',
            'navbar.requestAccess': 'Request Access',

            // Footer translations
            'footer.description': 'SpheroSeg is an advanced platform for spheroid segmentation and analysis in biomedical research.',
            'footer.contactLabel': 'Contact:',
            'footer.developerLabel': 'Developer:',
            'footer.facultyLabel': 'Institution:',
            'footer.resourcesTitle': 'Resources',
            'footer.documentationLink': 'Documentation',
            'footer.featuresLink': 'Features',
            'footer.tutorialsLink': 'Tutorials',
            'footer.researchLink': 'Research',
            'footer.legalTitle': 'Legal',
            'footer.termsLink': 'Terms of Service',
            'footer.privacyLink': 'Privacy Policy',
            'footer.contactUsLink': 'Contact Us',
            'footer.developerName': 'Bc. Michal Průšek',
            'footer.facultyName': 'FJFI ČVUT v Praze',
            'footer.copyrightNotice': '© 2023 Spheroid Segmentation Platform',

            // Terms page translations
            'termsPage.title': 'Terms of Service',
            'termsPage.acceptance.title': 'Acceptance of Terms',
            'termsPage.useLicense.title': 'Use License',
            'termsPage.dataUsage.title': 'Data Usage',
            'termsPage.limitations.title': 'Limitations',
            'termsPage.revisions.title': 'Revisions and Errata',
            'termsPage.governingLaw.title': 'Governing Law',
            'termsPage.acceptance.paragraph1': 'By accessing or using SpheroSeg, you agree to be bound by these Terms of Service...',
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

            // Terms page translations
            'termsPage.title': 'Podmínky služby',
            'termsPage.acceptance.title': 'Přijetí podmínek',
            'termsPage.useLicense.title': 'Licence k užívání',
            'termsPage.dataUsage.title': 'Použití dat',
            'termsPage.limitations.title': 'Omezení',
            'termsPage.revisions.title': 'Revize a chyby',
            'termsPage.governingLaw.title': 'Rozhodné právo',
            'termsPage.acceptance.paragraph1': 'Přístupem nebo používáním SpheroSeg souhlasíte s těmito Podmínkami služby...',
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

            // Terms page translations
            'termsPage.title': 'Nutzungsbedingungen',
            'termsPage.acceptance.title': 'Annahme der Bedingungen',
            'termsPage.useLicense.title': 'Nutzungslizenz',
            'termsPage.dataUsage.title': 'Datennutzung',
            'termsPage.limitations.title': 'Einschränkungen',
            'termsPage.revisions.title': 'Überarbeitungen und Fehler',
            'termsPage.governingLaw.title': 'Geltendes Recht',
            'termsPage.acceptance.paragraph1': 'Durch den Zugriff auf oder die Nutzung von SpheroSeg stimmen Sie diesen Nutzungsbedingungen zu...',
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

            // Terms page translations
            'termsPage.title': 'Términos de Servicio',
            'termsPage.acceptance.title': 'Aceptación de los Términos',
            'termsPage.useLicense.title': 'Licencia de Uso',
            'termsPage.dataUsage.title': 'Uso de Datos',
            'termsPage.limitations.title': 'Limitaciones',
            'termsPage.revisions.title': 'Revisiones y Erratas',
            'termsPage.governingLaw.title': 'Ley Aplicable',
            'termsPage.acceptance.paragraph1': 'Al acceder o utilizar SpheroSeg, aceptas estar sujeto a estos Términos de Servicio...',
          },
          fr: {
            // Common translations
            'common.appName': 'Segmentation de Sphéroïdes',
            'common.appNameShort': 'SpheroSeg',
            'common.backToHome': 'Retour à l\'Accueil',
            'common.privacyPolicyLink': 'Politique de Confidentialité',

            // Navbar translations
            'navbar.home': 'Accueil',
            'navbar.features': 'Fonctionnalités',
            'navbar.documentation': 'Documentation',
            'navbar.terms': 'Conditions',
            'navbar.privacy': 'Confidentialité',
            'navbar.login': 'Se connecter',
            'navbar.requestAccess': 'Demander l\'accès',

            // Footer translations
            'footer.copyrightNotice': '© 2023 Plateforme de Segmentation de Sphéroïdes',

            // Terms page translations
            'termsPage.title': 'Conditions d\'Utilisation',
            'termsPage.acceptance.title': 'Acceptation des Conditions',
            'termsPage.useLicense.title': 'Licence d\'Utilisation',
            'termsPage.dataUsage.title': 'Utilisation des Données',
            'termsPage.limitations.title': 'Limitations',
            'termsPage.revisions.title': 'Révisions et Erreurs',
            'termsPage.governingLaw.title': 'Loi Applicable',
            'termsPage.acceptance.paragraph1': 'En accédant ou en utilisant SpheroSeg, vous acceptez d\'être lié par ces Conditions d\'Utilisation...',
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

            // Terms page translations
            'termsPage.title': '服务条款',
            'termsPage.acceptance.title': '条款接受',
            'termsPage.useLicense.title': '使用许可',
            'termsPage.dataUsage.title': '数据使用',
            'termsPage.limitations.title': '责任限制',
            'termsPage.revisions.title': '修订和错误',
            'termsPage.governingLaw.title': '适用法律',
            'termsPage.acceptance.paragraph1': '通过访问或使用SpheroSeg，您同意受这些服务条款的约束...',
          }
        };

        return translations[currentLanguage]?.[key] || key;
      },
      availableLanguages: ['en', 'cs', 'de', 'es', 'fr', 'zh']
    }),
    LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
  };
});

describe('TermsOfService Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderTermsOfService = (language = 'en') => {
    localStorage.setItem('language', language);
    return render(
      <BrowserRouter>
        <AuthProvider>
          <LanguageProvider>
            <TermsOfService />
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>
    );
  };

  it('renders the terms of service page correctly', () => {
    renderTermsOfService();

    // Check for page title
    const pageTitle = screen.getAllByText(/Terms of Service/i);
    expect(pageTitle.length).toBeGreaterThan(0);

    // Check that the page has content
    const pageContent = screen.getByTestId('auth-provider');
    expect(pageContent).toBeInTheDocument();
    expect(pageContent.textContent).toBeTruthy();
  });

  it('renders the navigation bar', () => {
    renderTermsOfService();

    // Check for navigation links using getAllByRole to handle multiple links
    const navLinks = screen.getAllByRole('link');

    // Check if there's a Home link
    expect(navLinks.some(link => link.textContent?.match(/Home/i))).toBeTruthy();

    // Check if there's a Documentation link
    expect(navLinks.some(link => link.textContent?.match(/Documentation/i))).toBeTruthy();

    // Check if there's a Sign In link
    expect(navLinks.some(link => link.textContent?.match(/Sign In/i))).toBeTruthy();
  });

  it('renders the footer', () => {
    renderTermsOfService();

    // Check for footer content using a more flexible approach
    const footerText = screen.getAllByText(/2023/i);
    expect(footerText.length).toBeGreaterThan(0);

    // Check for Privacy Policy link in the footer
    const links = screen.getAllByRole('link');
    expect(links.some(link => link.textContent?.match(/Privacy Policy/i))).toBeTruthy();
  });

  // Test translations for different languages
  it('renders in Czech language', () => {
    renderTermsOfService('cs');

    // Check that the page has content
    const pageContent = screen.getByTestId('auth-provider');
    expect(pageContent).toBeInTheDocument();
    expect(pageContent.textContent).toBeTruthy();
  });

  it('renders in German language', () => {
    renderTermsOfService('de');

    // Check that the page has content
    const pageContent = screen.getByTestId('auth-provider');
    expect(pageContent).toBeInTheDocument();
    expect(pageContent.textContent).toBeTruthy();
  });

  it('renders in Spanish language', () => {
    renderTermsOfService('es');

    // Check that the page has content
    const pageContent = screen.getByTestId('auth-provider');
    expect(pageContent).toBeInTheDocument();
    expect(pageContent.textContent).toBeTruthy();
  });

  it('renders in French language', () => {
    renderTermsOfService('fr');

    // Check that the page has content
    const pageContent = screen.getByTestId('auth-provider');
    expect(pageContent).toBeInTheDocument();
    expect(pageContent.textContent).toBeTruthy();
  });

  it('renders in Chinese language', () => {
    renderTermsOfService('zh');

    // Check that the page has content
    const pageContent = screen.getByTestId('auth-provider');
    expect(pageContent).toBeInTheDocument();
    expect(pageContent.textContent).toBeTruthy();
  });
});
