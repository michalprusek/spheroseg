import { vi } from 'vitest';

// Mock i18next
export const mockI18n = {
  use: vi.fn().mockReturnThis(),
  init: vi.fn().mockReturnThis(),
  t: vi.fn((key: string) => key),
  changeLanguage: vi.fn().mockResolvedValue(undefined),
  language: 'en',
  isInitialized: true,
  on: vi.fn(),
  off: vi.fn(),
  services: {
    resourceStore: {
      data: {},
    },
  },
};

// Mock react-i18next
export const mockUseTranslation = () => ({
  t: mockI18n.t,
  i18n: mockI18n,
  ready: true,
});

export const mockTrans = ({ children }: { children: string }) => children;

export const mockI18nextProvider = ({ children }: { children: React.ReactNode }) => children;

// Set up module mocks
vi.mock('react-i18next', () => ({
  useTranslation: mockUseTranslation,
  Trans: mockTrans,
  I18nextProvider: mockI18nextProvider,
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));

vi.mock('i18next', () => ({
  default: mockI18n,
  createInstance: () => mockI18n,
}));