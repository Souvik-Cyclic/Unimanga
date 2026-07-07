/**
 * Single source of truth for the backend base URL.
 * Override by setting EXPO_PUBLIC_API_URL in .env (see .env.example).
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
