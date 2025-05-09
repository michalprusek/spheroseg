export interface UserProfile {
  user_id: string;
  username: string | null;
  full_name: string | null;
  title: string | null;
  organization: string | null;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  preferred_language: string | null;
  // Add email if it's also part of the /users/me response, otherwise it comes from AuthContext
  // email?: string; 
  // Add created_at/updated_at if needed by the frontend
  // created_at?: string;
  // updated_at?: string;
} 