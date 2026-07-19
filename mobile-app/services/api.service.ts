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
