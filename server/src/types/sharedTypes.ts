// Shared types used by both backend and frontend

// Possible statuses for an image, including client-side saving state
export type ImageStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'saving';

// Add other shared types here if needed in the future 