/**
 * Custom Hooks for Library Management
 * 
 * Separates library concerns from UI components
 */

import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService, UserManga, Category } from '../services/api.service';
import { cleanMangaTitle } from '../utils/mangaHelpers';

/**
 * Hook for managing library data and filtering
 */
export function useLibrary(onError?: (message: string) => void) {
  const [library, setLibrary] = useState<UserManga[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<'all' | 'manga' | 'manhwa' | 'manhua'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'added' | 'progress'>('recent');
  const [loading, setLoading] = useState(false);
  // List for scanning chapter numbers, gallery for browsing by cover. The
  // choice sticks between sessions because it is a reading habit, not a filter.
  const [viewMode, setViewModeState] = useState<'list' | 'gallery'>('list');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem('libraryViewMode').then((saved) => {
      if (active && (saved === 'list' || saved === 'gallery')) setViewModeState(saved);
    });
    return () => {
      active = false;
    };
  }, []);

  const setViewMode = useCallback((mode: 'list' | 'gallery') => {
    setViewModeState(mode);
    AsyncStorage.setItem('libraryViewMode', mode).catch((error) =>
      console.log('[useLibrary] Could not save the view mode:', error)
    );
  }, []);

  // Load library and categories
  const loadLibrary = useCallback(async () => {
    try {
      setLoading(true);
      const [libraryData, categoriesData] = await Promise.all([
        apiService.getUserLibrary(),
        apiService.getCategories(),
      ]);
      setLibrary(libraryData);
      setCategories(categoriesData);
    } catch (error) {
      console.log('[useLibrary] Failed to load library:', error);
      onError?.('Failed to load library');
    } finally {
      setLoading(false);
    }
  }, []); // Remove onError from dependencies to prevent infinite loop

  // Auto-reload library when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadLibrary();
    }, [loadLibrary])
  );

  // Filter library by category and search query
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredLibrary = library.filter((item) => {
    const matchesCategory =
      selectedCategory === 'all' || item.category._id === selectedCategory;
    const matchesSearch =
      normalizedQuery === '' ||
      cleanMangaTitle(item.manga.title).toLowerCase().includes(normalizedQuery);
    const matchesType =
      selectedType === 'all' ||
      (item.manga.genres ?? []).some(
        (genre) => genre.toLowerCase() === selectedType
      );
    return matchesCategory && matchesSearch && matchesType;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'title': {
        const titleA = cleanMangaTitle(a.manga.title).toLowerCase();
        const titleB = cleanMangaTitle(b.manga.title).toLowerCase();
        return titleA.localeCompare(titleB);
      }
      case 'added': {
        const addedA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const addedB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return addedB - addedA;
      }
      case 'progress':
        return (b.progress ?? 0) - (a.progress ?? 0);
      case 'recent':
      default: {
        // Unread series have no lastReadAt. Sorting them by updatedAt would
        // float never-opened titles above ones read today, so they sink
        // to the bottom of a "Last read" ordering instead.
        const recentA = a.lastReadAt ? new Date(a.lastReadAt).getTime() : 0;
        const recentB = b.lastReadAt ? new Date(b.lastReadAt).getTime() : 0;
        return recentB - recentA;
      }
    }
  });

  // Get manga count per category
  const getCategoryCount = (categoryId: string): number => {
    return library.filter((item) => item.category._id === categoryId).length;
  };

  return {
    library,
    filteredLibrary,
    categories,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    selectedType,
    setSelectedType,
    sortBy,
    setSortBy,
    loading,
    viewMode,
    setViewMode,
    loadLibrary,
    getCategoryCount,
