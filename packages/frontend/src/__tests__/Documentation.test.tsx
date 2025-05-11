import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Documentation from '../pages/Documentation';
import { LanguageProvider } from '../contexts/LanguageContext';

// Mock the constructUrl function
jest.mock('../lib/urlUtils', () => ({
  constructUrl: (url: string) => url,
}));

// Mock the components that are not relevant for this test
jest.mock('../components/Navbar', () => {
  const NavbarMock = () => <div data-testid="navbar-mock" />;
  NavbarMock.displayName = 'NavbarMock';
  return NavbarMock;
});

jest.mock('../components/ThemedFooter', () => {
  const ThemedFooterMock = () => <div data-testid="footer-mock" />;
  ThemedFooterMock.displayName = 'ThemedFooterMock';
  return ThemedFooterMock;
});

describe('Documentation Page', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  test('renders documentation page with hero image', () => {
    render(
      <BrowserRouter>
        <LanguageProvider>
          <Documentation />
        </LanguageProvider>
      </BrowserRouter>,
    );

    // Check if the page title is rendered
    expect(screen.getByText(/documentation.title/i)).toBeInTheDocument();

    // Check if the image is rendered with the correct src
    const image = screen.getByAltText(/documentation.introduction.imageAlt/i) as HTMLImageElement;
    expect(image).toBeInTheDocument();
    expect(image.src).toContain('026f6ae6-fa28-487c-8263-f49babd99dd3.png');
  });

  test('handles image loading error by using fallback image', () => {
    render(
      <BrowserRouter>
        <LanguageProvider>
          <Documentation />
        </LanguageProvider>
      </BrowserRouter>,
    );

    // Get the image element
    const image = screen.getByAltText(/documentation.introduction.imageAlt/i) as HTMLImageElement;

    // Simulate an error loading the image
    fireImageErrorEvent(image);

    // Check if the fallback image is used
    expect(image.src).toContain('19687f60-a78f-49e3-ada7-8dfc6a5fab4e.png');

    // Simulate another error to test the second fallback
    fireImageErrorEvent(image);

    // Check if the placeholder is used
    expect(image.src).toContain('/placeholder.png');
  });
});

// Helper function to fire an error event on an image
function fireImageErrorEvent(image: HTMLImageElement) {
  const errorEvent = new ErrorEvent('error');
  image.dispatchEvent(errorEvent);
}
