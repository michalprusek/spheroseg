import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import * as authService from '@/api/auth';
import { User, Profile } from '@/api/auth';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Načtení profilu uživatele
  const fetchUserProfile = async () => {
    try {
      if (!authService.isAuthenticated()) {
        return;
      }
      
      const response = await authService.getUserProfile();
      setProfile(response.data.profile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  useEffect(() => {
    // Inicializace auth stavu
    const initializeAuth = async () => {
      try {
        // Kontrola, zda je uživatel přihlášen
        if (authService.isAuthenticated()) {
          const currentUser = authService.getCurrentUser();
          setUser(currentUser);
          await fetchUserProfile();
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const response = await authService.signIn(email, password);
      
      setUser(response.data.user);
      await fetchUserProfile();
      
      toast.success("Successfully signed in", {
        description: "Welcome to the Spheroid Segmentation Platform",
      });
      
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error?.message || "Failed to sign in");
      console.error("Error signing in:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      setLoading(true);
      await authService.signUp(email, password);
      
      toast.success("Registration successful", {
        description: "Please proceed to sign in with your new account",
      });
      
      navigate("/sign-in");
    } catch (error: any) {
      toast.error(error?.message || "Failed to register");
      console.error("Error signing up:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await authService.signOut();
      
      // Reset stavu aplikace
      setUser(null);
      setProfile(null);
      
      toast.success("Signed out successfully");
      navigate("/sign-in");
    } catch (error: any) {
      toast.error(error?.message || "Failed to sign out");
      console.error("Error signing out:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
