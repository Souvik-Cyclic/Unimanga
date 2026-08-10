import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MangaMetadata } from '../utils/extractors/types';
import { apiService, Category } from '../services/api.service';
import CategorySelector from './CategorySelector';
import { cleanMangaTitle, extractChapterNumber } from '../utils/mangaHelpers';
import { useTheme } from '../constants/ThemeContext';
import { Palette } from '../constants/theme';
import { Toast, useToast } from './Toast';
import { Cover, Data, Eyebrow, PrimaryButton } from './ui';

interface ReaderOverlayProps {
  visible: boolean;
  metadata: MangaMetadata | null;
  // The URL actually on screen right now, which may be a chapter page the
  // user navigated into after metadata was cached from an earlier visit to
  // the series detail page (metadata.sourceUrl). Chapter-number extraction
  // must run against THIS url, not metadata.sourceUrl - the detail page URL
  // never carries a chapter number, so using it here silently produced "0"
  // (Not Started) even when the user was mid-chapter when they tapped Add.
  currentUrl?: string;
  onClose: () => void;
  onSuccess: (userMangaId: string) => void;
}

/** Publication status of the series itself, not the reader's progress. */
function seriesStatusColors(colors: Palette): Record<string, string> {
  return {
    completed: colors.success,
    hiatus: colors.gold,
    cancelled: colors.toneDim,
    ongoing: colors.accent,
  };
}

export default function ReaderOverlay({
  visible,
  metadata,
  currentUrl,
  onClose,
  onSuccess,
}: ReaderOverlayProps) {
  const { colors, type } = useTheme();
  const SERIES_STATUS = seriesStatusColors(colors);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [addingToLibrary, setAddingToLibrary] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    if (visible) {
      console.log('ReaderOverlay opened, loading categories...');
      loadCategories();
    }
  }, [visible]);

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const fetchedCategories = await apiService.getCategories();
      setCategories(fetchedCategories);

      if (fetchedCategories.length === 0) {
        console.warn('No categories found for user. User may need to create categories first.');
      }
    } catch (error: any) {
      console.log('Failed to load categories:', error);
      const errorMessage =
        error.response?.data?.message || 'Could not load your shelves. Check your connection.';
      showToast(errorMessage, 'error');
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleAddToLibrary = () => {
    if (!metadata) return;
    setShowCategorySelector(true);
  };

  const handleCategorySelect = async (categoryId: string) => {
    if (!metadata) return;

    try {
      setAddingToLibrary(true);
      setShowCategorySelector(false);

      // Clean the title and extract chapter number. Prefer the URL actually
      // on screen (may be a chapter page the user read into after metadata
      // was cached from the series page) over metadata.sourceUrl, which is
      // always the detail page and never carries a chapter number.
      const cleanedTitle = cleanMangaTitle(metadata.title);
      const chapterSourceUrl = currentUrl || metadata.sourceUrl;
      const chapterNumber = extractChapterNumber(chapterSourceUrl, metadata.title) || '0';

      const userManga = await apiService.addMangaToLibrary({
        title: cleanedTitle || metadata.title, // Use cleaned title
        description: metadata.description,
        author: metadata.author,
        artist: metadata.artist,
        coverImage: metadata.coverImage,
        sourceWebsite: metadata.sourceWebsite,
        sourceUrl: metadata.sourceUrl,
        genres: metadata.genres,
        mangaStatus: metadata.mangaStatus,
        totalChapters: metadata.totalChapters,
        alternativeTitles: metadata.alternativeTitles,
        lastChapterAdded: metadata.lastChapterAdded,
        rating: metadata.rating,
        categoryId,
        readingStatus: 'reading',
        currentChapter: chapterNumber, // Use extracted chapter number
        lastReadUrl: chapterSourceUrl,
      });

      showToast(`${cleanedTitle || metadata.title} added to your library`, 'success');
      // Pass the freshly-created entry's id up so the browser screen can
      // start tracking reading progress immediately in this same session,
      // instead of only working after the user leaves and reopens via
      // "Continue Reading" (which is what supplies userMangaId normally).
      onSuccess(userManga._id);
      onClose();
    } catch (error: any) {
      console.log('Failed to add manga to library:', error);

      // Check if manga already exists
      if (error.response?.data?.message?.includes('already in your library')) {
        showToast('This series is already in your library', 'info');
      } else {
        showToast('Could not add the series. Try again.', 'error');
      }
    } finally {
      setAddingToLibrary(false);
    }
  };

  if (!visible || !metadata) return null;

  const title = cleanMangaTitle(metadata.title) || metadata.title;

  return (
    <>
      {/* Detail panel, anchored to the bottom of the reader */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.panel,
