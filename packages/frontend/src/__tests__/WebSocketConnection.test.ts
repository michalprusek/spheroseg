import { getSocketUrl } from '../socketClient';
import { isValidToken, getAccessToken } from '../services/authService';

// Mock window.location
const originalLocation = window.location;

describe('WebSocket Connection', () => {
  beforeEach(() => {
    // Mock localStorage
    Storage.prototype.getItem = jest.fn();
    Storage.prototype.setItem = jest.fn();
    Storage.prototype.removeItem = jest.fn();

    // Reset mocks
    jest.clearAllMocks();

    // Mock window.location
    delete window.location;
    window.location = {
      ...originalLocation,
      protocol: 'http:',
      host: 'localhost:3005',
      origin: 'http://localhost:3005',
      port: '3005',
    } as Partial<Location>;
  });

  afterEach(() => {
    // Restore window.location
    window.location = originalLocation;
  });

  describe('getSocketUrl', () => {
    it('should return the correct URL with localhost', () => {
      const url = getSocketUrl();
      expect(url).toBe('http://localhost:3005');
    });

    it('should replace 0.0.0.0 with localhost', () => {
      // Mock window.location with 0.0.0.0
      window.location = {
        ...originalLocation,
        protocol: 'http:',
        host: '0.0.0.0:3005',
        origin: 'http://0.0.0.0:3005',
        port: '3005',
      } as Partial<Location>;

      const url = getSocketUrl();
      expect(url).toBe('http://localhost:3005');
      expect(url).not.toContain('0.0.0.0');
    });
  });

  describe('Token Validation', () => {
    const validToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const invalidToken = 'invalid.token';
    const emptyToken = '';

    it('should validate a properly formatted token', () => {
      expect(isValidToken(validToken)).toBe(true);
    });

    it('should reject an invalid token format', () => {
      expect(isValidToken(invalidToken)).toBe(false);
    });

    it('should reject an empty token', () => {
      expect(isValidToken(emptyToken)).toBe(false);
    });

    it('should reject a null token', () => {
      expect(isValidToken(null)).toBe(false);
    });

    it('should get a valid token from localStorage', () => {
      // Mock localStorage.getItem to return a valid token
      jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(validToken);

      const token = getAccessToken();
      expect(token).toBe(validToken);
    });

    it('should return null for an invalid token when validation is enabled', () => {
      // Mock localStorage.getItem to return an invalid token
      jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(invalidToken);

      const token = getAccessToken(true);
      expect(token).toBeNull();
    });

    it('should remove an invalid token when removeIfInvalid is true', () => {
      // Mock localStorage.getItem to return an invalid token
      jest.spyOn(Storage.prototype, 'getItem').mockReturnValue(invalidToken);

      const token = getAccessToken(true, true);
      expect(token).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalled();
    });
  });
});
