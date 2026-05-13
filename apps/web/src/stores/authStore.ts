import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../lib/api';

interface User {
  id: string;
  email: string;
}

interface Tenant {
  id: string;
  name: string;
  role: string;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: User | null;
  tokens: Tokens | null;
  currentTenant: Tenant | null;
  tenants: Tenant[];
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  selectTenant: (tenantId: string) => Promise<void>;
  setTokens: (tokens: Tokens) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      currentTenant: null,
      tenants: [],
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        const response = await api.post('/auth/login', { email, password });
        const { accessToken, refreshToken, user, tenants, currentTenant } = response.data;

        const tokens = { accessToken, refreshToken };
        localStorage.setItem('auth-tokens', JSON.stringify(tokens));

        set({
          user,
          tokens,
          currentTenant,
          tenants,
          isAuthenticated: true,
        });
      },

      logout: () => {
        localStorage.removeItem('auth-tokens');
        set({
          user: null,
          tokens: null,
          currentTenant: null,
          tenants: [],
          isAuthenticated: false,
        });
      },

      selectTenant: async (tenantId: string) => {
        const response = await api.post('/auth/select-tenant', { tenantId });
        const { accessToken, refreshToken, tenant } = response.data;

        const tokens = { accessToken, refreshToken };
        localStorage.setItem('auth-tokens', JSON.stringify(tokens));

        set({
          tokens,
          currentTenant: tenant,
        });
      },

      setTokens: (tokens: Tokens) => {
        localStorage.setItem('auth-tokens', JSON.stringify(tokens));
        set({ tokens });
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        currentTenant: state.currentTenant,
        tenants: state.tenants,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
