import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Documentation from '../pages/Documentation';
import { LanguageProvider } from '../contexts/LanguageContext';

// Mock the constructUrl function
vi.mock('../lib/urlUtils', () => ({
  constructUrl: (url: string) => url,
}));

// Mock the components that are not relevant for this test
vi.mock('../components/Navbar', () => ({
  default: () => <div data-testid="navbar-mock" />,
}));

vi.mock('../components/ThemedFooter', () => ({
  default: () => <div data-testid="footer-mock" />,
}));

describe('Documentation Page', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
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
    expect(image.src).toContain('/assets/illustrations/documentation-image.png');
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
    expect(image.src).toContain('026f6ae6-fa28-487c-8263-f49babd99dd3.png');

    // Note: Testing nested onerror handlers is complex in the test environment
    // since they involve dynamically setting event handlers. This test verifies
    // the first level of fallback which covers the main error handling pattern.
  });
});

// Helper function to fire an error event on an image
function fireImageErrorEvent(image: HTMLImageElement) {
  fireEvent.error(image);
}
