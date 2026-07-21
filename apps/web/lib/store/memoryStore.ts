import { create } from "zustand";
import { api } from "@/lib/api";

export interface MemoryItem {
  id: string;
  content: string;
  content_type: "observation" | "knowledge" | "plan" | "result" | "error";
  source: string;
  tags: string[];
  score: number;
  created_at: string;
  collection_id?: string;
}

export interface MemoryCollection {
  id: string;
  name: string;
  description?: string;
  content_type: string;
  item_count: number;
  created_at: string;
}

interface MemoryState {
  collections: MemoryCollection[];
  items: MemoryItem[];
  searchResults: MemoryItem[];
  loading: boolean;
  fetchCollections: (workspaceId: string) => Promise<void>;
  fetchItems: (collectionId: string) => Promise<void>;
  createItem: (collectionId: string, data: Partial<MemoryItem>) => Promise<void>;
  deleteItem: (collectionId: string, itemId: string) => Promise<void>;
  searchItems: (collectionId: string, query: string) => Promise<void>;
}

export const useMemoryStore = create<MemoryState>((set) => ({
  collections: [],
  items: [],
  searchResults: [],
  loading: false,

  fetchCollections: async (workspaceId) => {
    set({ loading: true });
    try {
      const data = await api.listCollections(workspaceId);
      set({ collections: Array.isArray(data) ? (data as unknown as MemoryCollection[]) : [] });
    } catch (e) {
      console.error("fetchCollections", e);
    } finally {
      set({ loading: false });
    }
  },

  fetchItems: async (collectionId) => {
    try {
      const data = await api.listMemoryItems(collectionId);
      const items = Array.isArray(data) ? (data as unknown as MemoryItem[]) : [];
      set({ items, searchResults: [] });
    } catch (e) {
      console.error("fetchItems", e);
    }
  },

  createItem: async (collectionId, data) => {
    try {
      await api.createMemoryItem(collectionId, data as Record<string, unknown>);
    } catch (e) {
      console.error("createItem", e);
      throw e;
    }
  },

  deleteItem: async (collectionId, itemId) => {
    try {
      await api.deleteMemoryItem(collectionId, itemId);
      set((state) => ({ items: state.items.filter((i) => i.id !== itemId) }));
    } catch (e) {
      console.error("deleteItem", e);
      throw e;
    }
  },

  searchItems: async (collectionId, query) => {
    try {
      const data = await api.searchMemory(collectionId, query);
      set({ searchResults: Array.isArray(data) ? (data as unknown as MemoryItem[]) : [] });
    } catch (e) {
      console.error("searchItems", e);
    }
  },
}));