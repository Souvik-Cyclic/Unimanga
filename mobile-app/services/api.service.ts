import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as SERVER_URL } from '../config/env';

const API_BASE_URL = `${SERVER_URL}/api`;

// Helper to get auth headers
const getAuthHeaders = async () => {
  const token = await AsyncStorage.getItem('token');
  return {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
};

export interface Website {
  _id: string;
  name: string;
  url: string;
  language: string;
  color: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Manga {
  _id: string;
  title: string;
  alternativeTitles: string[];
  description?: string;
  author?: string;
  artist?: string;
  coverImage?: string;
  genres: string[];
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
  sourceWebsite: Website | string;
  sourceUrl: string;
  totalChapters: number;
  lastChapterAdded?: string;
  rating?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  _id: string;
  name: string;
  user: string;
  color: string;
  icon: string;
  order: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserManga {
  _id: string;
  user: string;
  manga: Manga;
  category: Category;
  currentChapter: string;
  totalChaptersRead: number;
  progress: number;
  lastReadUrl?: string;
  status: 'reading' | 'plan-to-read' | 'completed' | 'on-hold' | 'dropped';
  favorite: boolean;
  startedAt?: string;
  completedAt?: string;
  lastReadAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReadHistoryEntry {
  _id: string;
  user: string;
  manga: Manga;
  userManga?: string;
  chapter: string;
  chapterUrl?: string;
  readAt: string;
  createdAt: string;
  updatedAt: string;
}

export const apiService = {
  // Reading history
  async getHistory(limit = 100): Promise<{ history: ReadHistoryEntry[]; total: number }> {
    try {
      const config = await getAuthHeaders();
      const response = await axios.get(`${API_BASE_URL}/history?limit=${limit}`, config);
      return { history: response.data.history ?? [], total: response.data.total ?? 0 };
    } catch (error) {
      console.log('Error fetching history:', error);
      throw error;
    }
  },

  async deleteHistoryEntry(entryId: string): Promise<void> {
    const config = await getAuthHeaders();
    await axios.delete(`${API_BASE_URL}/history/${entryId}`, config);
  },

  async clearHistory(): Promise<number> {
    const config = await getAuthHeaders();
    const response = await axios.delete(`${API_BASE_URL}/history`, config);
    return response.data.removed ?? 0;
  },

  // Websites
  /**
   * Catalogue browse. This endpoint is public, so the auth screens can show
   * real cover art before anyone has signed in.
   */
  async getPublicManga(): Promise<Manga[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/manga`);
      return response.data.manga ?? [];
    } catch (error) {
      console.log('Error fetching catalogue:', error);
      return [];
    }
  },

  async getWebsites(): Promise<Website[]> {
    try {
      const config = await getAuthHeaders();
      // isActive=true - the Sources list should only ever show sites the
      // backend currently considers usable. Without this, a deactivated
      // site (e.g. AsuraScans, disabled after its adapter never reliably
      // extracted metadata) still shows up here, since GET /websites
      // returns everything unless isActive is explicitly passed as a query
      // param (see website.controller.js).
      const response = await axios.get(`${API_BASE_URL}/websites`, {
        ...config,
        params: { isActive: true },
      });
      return response.data.websites;
    } catch (error) {
      console.log('Error fetching websites:', error);
      throw error;
    }
  },

  // Library
  async getUserLibrary(filters?: {
    categoryId?: string;
    status?: string;
    favorite?: boolean;
  }): Promise<UserManga[]> {
    try {
      const config = await getAuthHeaders();
      const params = new URLSearchParams();
      if (filters?.categoryId) params.append('categoryId', filters.categoryId);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.favorite !== undefined) params.append('favorite', filters.favorite.toString());
      
      const url = `${API_BASE_URL}/library${params.toString() ? '?' + params.toString() : ''}`;
      const response = await axios.get(url, config);
      return response.data.library;
    } catch (error) {
      console.log('Error fetching library:', error);
      throw error;
    }
  },

  async addMangaToLibrary(data: {
    mangaId?: string;
    title?: string;
    description?: string;
    author?: string;
    artist?: string;
    coverImage?: string;
    sourceWebsite?: string;
    sourceUrl?: string;
    genres?: string[];
    mangaStatus?: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
    totalChapters?: number;
    alternativeTitles?: string[];
    lastChapterAdded?: string;
    rating?: number;
    categoryId: string;
    readingStatus?: 'reading' | 'plan-to-read' | 'completed' | 'on-hold' | 'dropped';
    currentChapter?: string;
    lastReadUrl?: string;
  }): Promise<UserManga> {
    try {
      const config = await getAuthHeaders();
      const response = await axios.post(`${API_BASE_URL}/library`, data, config);
      return response.data.userManga;
    } catch (error) {
      console.log('Error adding manga to library:', error);
      throw error;
    }
  },

  // Categories
  async getCategories(): Promise<Category[]> {
    try {
      const config = await getAuthHeaders();
      const response = await axios.get(`${API_BASE_URL}/categories`, config);
      return response.data.categories;
    } catch (error) {
      console.log('Error fetching categories:', error);
      throw error;
    }
  },

  async createCategory(data: {
    name: string;
    color?: string;
    icon?: string;
  }): Promise<Category> {
    try {
      const config = await getAuthHeaders();
      const response = await axios.post(`${API_BASE_URL}/categories`, data, config);
      return response.data.category;
    } catch (error) {
      console.log('Error creating category:', error);
      throw error;
    }
  },

  async updateCategory(id: string, data: {
    name?: string;
    color?: string;
    icon?: string;
    order?: number;
  }): Promise<Category> {
    try {
      const config = await getAuthHeaders();
      const response = await axios.put(`${API_BASE_URL}/categories/${id}`, data, config);
      return response.data.category;
    } catch (error) {
      console.log('Error updating category:', error);
      throw error;
    }
  },

  async deleteCategory(id: string): Promise<void> {
    try {
      const config = await getAuthHeaders();
      await axios.delete(`${API_BASE_URL}/categories/${id}`, config);
    } catch (error) {
      console.log('Error deleting category:', error);
      throw error;
    }
  },

  async updateMangaProgress(id: string, data: {
    currentChapter?: string;
    lastReadUrl?: string;
    totalChaptersRead?: number;
    progress?: number;
    status?: 'reading' | 'plan-to-read' | 'completed' | 'on-hold' | 'dropped';
  }): Promise<UserManga> {
    try {
      const config = await getAuthHeaders();
      const response = await axios.put(`${API_BASE_URL}/library/${id}/progress`, data, config);
      return response.data.userManga;
    } catch (error) {
      console.log('Error updating manga progress:', error);
      throw error;
    }
  },

  async deleteMangaFromLibrary(id: string): Promise<void> {
    try {
      const config = await getAuthHeaders();
      await axios.delete(`${API_BASE_URL}/library/${id}`, config);
    } catch (error) {
      console.log('Error deleting manga from library:', error);
      throw error;
    }
  },

  async updateMangaCategory(id: string, categoryId: string): Promise<UserManga> {
    try {
      const config = await getAuthHeaders();
      const response = await axios.put(`${API_BASE_URL}/library/${id}/category`, { categoryId }, config);
      return response.data.userManga;
    } catch (error) {
      console.log('Error updating manga category:', error);
      throw error;
    }
  },

  async toggleFavorite(id: string): Promise<UserManga> {
    try {
      const config = await getAuthHeaders();
      const response = await axios.put(`${API_BASE_URL}/library/${id}/favorite`, {}, config);
      return response.data.userManga;
    } catch (error) {
      console.log('Error toggling favorite:', error);
      throw error;
    }
  },
};
