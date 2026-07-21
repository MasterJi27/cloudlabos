import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar_url?: string | null;
  mfa_enabled?: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  role: string;
  description?: string | null;
  created_at: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  workspaces: Workspace[];
  currentWorkspace: string | null;
  loading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  fetchWorkspaces: () => Promise<void>;
  setCurrentWorkspace: (id: string) => void;
  refreshAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      workspaces: [],
      currentWorkspace: null,
      loading: false,

      login: async (email, password) => {
        const res = await api.login(email, password);
        api.setToken(res.access_token);
        set({
          token: res.access_token,
          refreshToken: res.refresh_token,
          isAuthenticated: true,
          user: (res as any).user || null,
        });
        // Fetch workspaces in background
        try {
          const workspaces = await api.listWorkspaces();
          const ws = Array.isArray(workspaces) ? workspaces : [];
          set({ workspaces: ws, currentWorkspace: ws[0]?.id || null });
        } catch {
          // workspace fetch is optional
        }
      },

      register: async (email, password, name) => {
        const res = await api.register(email, password, name);
        api.setToken(res.access_token);
        set({
          token: res.access_token,
          refreshToken: res.refresh_token,
          isAuthenticated: true,
          user: (res as any).user || null,
        });
        try {
          const workspaces = await api.listWorkspaces();
          const ws = Array.isArray(workspaces) ? workspaces : [];
          set({ workspaces: ws, currentWorkspace: ws[0]?.id || null });
        } catch {
          // workspace fetch is optional
        }
      },

      logout: () => {
        api.setToken(null);
        localStorage.removeItem("token");
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          workspaces: [],
          currentWorkspace: null,
        });
      },

      fetchMe: async () => {
        const token = get().token || localStorage.getItem("token");
        if (!token) return;
        api.setToken(token);
        set({ loading: true });
        try {
          const user = await api.getMe();
          set({ user, isAuthenticated: true, token });
          await get().fetchWorkspaces();
        } catch {
          // User fetch failed - token may be stale, but don't clear auth state
        } finally {
          set({ loading: false });
        }
      },

      fetchWorkspaces: async () => {
        try {
          const data = await api.listWorkspaces();
          const workspaces = Array.isArray(data) ? data : [];
          set((state) => ({
            workspaces,
            currentWorkspace: state.currentWorkspace || workspaces[0]?.id || null,
          }));
        } catch {
          // Workspace fetch failed
        }
      },

      setCurrentWorkspace: (id) => set({ currentWorkspace: id }),

      refreshAuth: async () => {
        const refreshToken = get().refreshToken;
        if (!refreshToken) throw new Error("No refresh token");
        const res = await api.refresh(refreshToken);
        api.setToken(res.access_token);
        set({
          token: res.access_token,
          refreshToken: res.refresh_token,
        });
      },
    }),
    {
      name: "cloudlabos-auth",
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        currentWorkspace: state.currentWorkspace,
      }),
    },
  ),
);
