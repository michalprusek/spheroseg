import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Navbar from '../Navbar';
import '@testing-library/jest-dom';

// Mock the useLanguage hook
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'common.appNameShort': 'SpheroSeg',
        'navbar.home': 'Home',
        'navbar.documentation': 'Documentation',
        'navbar.terms': 'Terms',
        'navbar.privacy': 'Privacy',
        'navbar.login': 'Login',
        'navbar.requestAccess': 'Request Access',
        'settings.selectLanguage': 'Select Language',
      };
      return translations[key] || key;
    },
    language: 'en',
    setLanguage: vi.fn(),
    availableLanguages: ['en', 'cs', 'de', 'es', 'fr', 'zh'],
  }),
}));

// Mock the AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    checkAuth: vi.fn(),
  }),
}));

const renderNavbar = () => {
  return render(
    <BrowserRouter>
      <Navbar />
    </BrowserRouter>
  );
};

describe('Navbar Component', () => {
  it('renders the logo and app name', () => {
    renderNavbar();
    expect(screen.getByText('SpheroSeg')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    renderNavbar();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Documentation')).toBeInTheDocument();
    expect(screen.getByText('Terms')).toBeInTheDocument();
    expect(screen.getByText('Privacy')).toBeInTheDocument();
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByText('Request Access')).toBeInTheDocument();
  });

  it('toggles mobile menu when menu button is clicked', async () => {
    renderNavbar();

    // Find and click the mobile menu button
    const menuButton = screen.getByLabelText('Toggle menu');
    expect(menuButton).toBeInTheDocument();

    // Click to open the menu
    fireEvent.click(menuButton);

    // Check if the mobile menu container is rendered
    const mobileMenuContainer = document.querySelector('.md\\:hidden.absolute');
    expect(mobileMenuContainer).toBeInTheDocument();

    // Click again to close
    fireEvent.click(menuButton);

    // Mobile menu should be hidden again
    await waitFor(() => {
      expect(document.querySelector('.md\\:hidden.absolute')).not.toBeInTheDocument();
    });
  });

  it('displays language dropdown button', () => {
    renderNavbar();

    // Find the language dropdown button by its icon
    const globeIcon = document.querySelector('.lucide-globe');
    expect(globeIcon).toBeInTheDocument();

    // Verify the button containing the icon exists
    const languageButton = globeIcon?.closest('button');
    expect(languageButton).toBeInTheDocument();
  });

  it('changes background on scroll', async () => {
    renderNavbar();

    // Initially, header should not have the scrolled background
    const header = screen.getByRole('banner');
    expect(header).toHaveClass('bg-transparent');

    // Simulate scrolling
    fireEvent.scroll(window, { target: { scrollY: 20 } });

    // After scrolling, header should have the scrolled background
    await waitFor(() => {
      expect(header).toHaveClass('bg-white/80');
    });
  });
});
