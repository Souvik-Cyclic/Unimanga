import { create } from 'zustand';
import { authService } from '../services/auth.service';

interface User {
    id: string;
    username: string;
    email: string;
    [key: string]: any;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    login: (email: string, password: string) => Promise<void>;
    signup: (username: string, email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    initialize: () => Promise<void>;
    updateUser: (partial: Partial<User>) => void;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,

    login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
            const response = await authService.login(email, password);
            set({
                user: response.existingUser || response.user,
                token: response.token,
                isAuthenticated: true,
                isLoading: false,
            });
        } catch (error) {
            set({
                error: error as string,
                isLoading: false,
                isAuthenticated: false,
            });
            throw error;
        }
    },

    signup: async (username, email, password) => {
        set({ isLoading: true, error: null });
        try {
            const response = await authService.register(username, email, password);
            set({
                user: response.user,
                token: response.token,
                isAuthenticated: true,
                isLoading: false,
            });
        } catch (error) {
            set({
                error: error as string,
                isLoading: false,
                isAuthenticated: false,
            });
            throw error;
        }
    },

    logout: async () => {
        set({ isLoading: true });
        try {
            await authService.logout();
            set({
                user: null,
                token: null,
                isAuthenticated: false,
                isLoading: false,
            });
        } catch (error) {
            set({ isLoading: false });
            console.error('Logout error:', error);
        }
    },

    initialize: async () => {
        set({ isLoading: true });
        try {
            const token = await authService.getToken();
            const user = await authService.getUser();

            if (token && user) {
                set({
                    token,
                    user,
                    isAuthenticated: true,
                    isLoading: false,
                });
            } else {
                set({
                    token: null,
                    user: null,
                    isAuthenticated: false,
                    isLoading: false,
                });
            }
        } catch (error) {
            set({
                token: null,
                user: null,
                isAuthenticated: false,
                isLoading: false,
            });
        }
    },

    updateUser: (partial) => {
        set((state) => ({
            user: state.user ? { ...state.user, ...partial } : state.user,
        }));
    },

    clearError: () => set({ error: null }),
}));
