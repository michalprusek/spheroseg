import apiClient from './client';

// Interface pro objekt uživatele
export interface User {
  id: string;
  email: string;
}

export interface Profile {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  preferredLanguage: string;
  preferredTheme: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  status: string;
  data: {
    user: User;
    token: string;
  };
}

export interface ProfileResponse {
  status: string;
  data: {
    id: string;
    email: string;
    profile: Profile;
  };
}

/**
 * Přihlášení uživatele
 */
export const signIn = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    const response = await apiClient.post('/auth/login', { email, password });
    
    // Uložit token a informace o uživateli
    localStorage.setItem('authToken', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    
    return response;
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
};

/**
 * Registrace uživatele
 */
export const signUp = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    const response = await apiClient.post('/auth/register', { email, password });
    return response;
  } catch (error) {
    console.error('Error signing up:', error);
    throw error;
  }
};

/**
 * Odhlášení uživatele
 */
export const signOut = async (): Promise<void> => {
  try {
    // Odstranit token a informace o uživateli z localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

/**
 * Získat profil přihlášeného uživatele
 */
export const getUserProfile = async (): Promise<ProfileResponse> => {
  try {
    const response = await apiClient.get('/users/profile');
    return response;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
};

/**
 * Kontrola, zda je uživatel přihlášen
 */
export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('authToken');
};

/**
 * Získat aktuálního uživatele z localStorage
 */
export const getCurrentUser = (): User | null => {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      return JSON.parse(userStr) as User;
    } catch (e) {
      return null;
    }
  }
  return null;
}; 