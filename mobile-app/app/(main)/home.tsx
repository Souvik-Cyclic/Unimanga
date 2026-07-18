import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { apiService, Website, UserManga } from '../../services/api.service';
import { cleanMangaTitle, formatChapterDisplay, calculateProgress } from '../../utils/mangaHelpers';
import { useLibrary, useMangaActions, useMangaMenu } from '../../hooks/useLibrary';
import { useTheme } from '../../constants/ThemeContext';
import { Toast, useToast } from '../../components/Toast';
import MangaQuickView from '../../components/MangaQuickView';
import LibraryFilterSheet from '../../components/LibraryFilterSheet';
import {
  Cover,
  CoverStrip,
  CoverWash,
  Data,
  Eyebrow,
  EmptyState,
  Field,
  GhostButton,
  Halftone,
  PrimaryButton,
  ProgressRule,
  Sheet,
  SiteIcon,
} from '../../components/ui';

export default function HomeScreen() {
  const { colors, type, statusMeta, scheme, toggle } = useTheme();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const [activeTab, setActiveTab] = useState<'sources' | 'library'>('library');
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loadingWebsites, setLoadingWebsites] = useState(true);
  const { toast, showToast, hideToast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteCallback, setDeleteCallback] = useState<(() => void) | null>(null);
  const [showEditProgress, setShowEditProgress] = useState(false);
  const [editProgressValue, setEditProgressValue] = useState('');
  const [savingProgress, setSavingProgress] = useState(false);
  const [quickViewItem, setQuickViewItem] = useState<UserManga | null>(null);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  // Use custom hooks for library management
  const library = useLibrary((error) => showToast(error, 'error'));
  const mangaMenu = useMangaMenu();
  const mangaActions = useMangaActions(
    (message) => {
      library.loadLibrary();
      mangaMenu.closeAll();
      showToast(message, 'success');
    },
    (message) => showToast(message, 'error'),
    (title, message, onYes) => {
      setDeleteCallback(() => onYes);
      setShowDeleteConfirm(true);
    }
  );

  useEffect(() => {
    loadWebsites();
  }, []);

  const loadWebsites = async () => {
    try {
      setLoadingWebsites(true);
      const data = await apiService.getWebsites();
      setWebsites(data);
    } catch (error) {
      console.log('Failed to load websites:', error);
    } finally {
      setLoadingWebsites(false);
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (activeTab === 'sources') {
        await loadWebsites();
      } else {
        await library.loadLibrary();
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    console.log('Logging out...');
    await logout();
    router.replace('/(auth)/login');
  };

  const handleOpenWebsite = (website: Website) => {
    router.push({
      pathname: '/(main)/browser',
      params: {
        name: website.name,
        url: website.url,
        color: website.color,
        websiteId: website._id,
      },
    });
  };

  const handleOpenManga = (item: UserManga, urlOverride?: string) => {
    // Open browser at an explicit URL (e.g. from the quick-view panel's
    // "Chapters"/continue actions), falling back to the last read URL or
    // the manga's main URL.
    const urlToOpen = urlOverride || item.lastReadUrl || item.manga.sourceUrl;
    const websiteInfo = typeof item.manga.sourceWebsite === 'object'
      ? item.manga.sourceWebsite
      : null;

    router.push({
      pathname: '/(main)/browser',
      params: {
        name: websiteInfo?.name || 'Manga',
        url: urlToOpen,
        color: websiteInfo?.color || colors.accent,
        mangaId: item.manga._id,
        userMangaId: item._id,
      },
    });
  };

  const handleDeleteManga = async () => {
    if (!mangaMenu.selectedManga) return;
    await mangaActions.deleteManga(
      mangaMenu.selectedManga._id,
      cleanMangaTitle(mangaMenu.selectedManga.manga.title)
    );
  };

  const handleToggleFavorite = async (item: UserManga) => {
    await mangaActions.toggleFavorite(
      item._id,
      cleanMangaTitle(item.manga.title),
      item.favorite
    );
  };

  const isValidProgressValue = (value: string) => /^\d+(\.\d+)?$/.test(value.trim());

  const handleOpenEditProgress = () => {
    if (!mangaMenu.selectedManga) return;
    setEditProgressValue(mangaMenu.selectedManga.currentChapter ?? '');
    setShowEditProgress(true);
  };

  const handleCloseEditProgress = () => {
    setShowEditProgress(false);
  };

  const handleSaveProgress = async () => {
    if (!mangaMenu.selectedManga) return;
    const trimmedValue = editProgressValue.trim();
    if (!isValidProgressValue(trimmedValue)) return;

    try {
      setSavingProgress(true);
      await apiService.updateMangaProgress(mangaMenu.selectedManga._id, {
        currentChapter: trimmedValue,
        ...(mangaMenu.selectedManga.status !== 'completed' ? { status: 'reading' as const } : {}),
      });
      await library.loadLibrary();
      setShowEditProgress(false);
      mangaMenu.closeAll();
      showToast('Progress updated', 'success');
    } catch (error) {
      showToast('Failed to update progress', 'error');
    } finally {
      setSavingProgress(false);
    }
  };

  const handleCategorySelect = async (categoryId: string) => {
    if (!mangaMenu.selectedManga) return;
    await mangaActions.changeMangaCategory(
      mangaMenu.selectedManga._id,
      categoryId,
      cleanMangaTitle(mangaMenu.selectedManga.manga.title)
    );
    mangaMenu.closeAll();
  };

  /** Source colour drives the spine strip on every library entry. */
  const sourceOf = (item: UserManga) =>
    typeof item.manga.sourceWebsite === 'object' ? item.manga.sourceWebsite : null;

  const progressOf = (item: UserManga) =>
    item.progress || calculateProgress(item.currentChapter, item.manga.totalChapters);

  const activeFilterCount = [
    library.selectedCategory !== 'all',
    library.selectedType !== 'all',
    library.sortBy !== 'recent',
  ].filter(Boolean).length;

  /** The reader's masthead figures: what they hold, and how much is in flight. */
  const stats = useMemo(() => {
    const reading = library.library.filter((item) => item.status === 'reading').length;
    const chapters = library.library.reduce(
      (sum, item) => sum + (parseFloat(item.currentChapter) || 0),
      0
    );
    return { series: library.library.length, reading, chapters: Math.round(chapters) };
  }, [library.library]);

  /** Hero: the series to pick back up, shown only on an unfiltered library. */
  const isUnfiltered =
    library.selectedCategory === 'all' &&
    library.selectedType === 'all' &&
    library.searchQuery.trim() === '';

  const continueItem = useMemo(() => {
    const inProgress = library.library
      .filter((item) => item.status === 'reading' && item.lastReadAt)
      .sort(
        (a, b) =>
          new Date(b.lastReadAt ?? 0).getTime() - new Date(a.lastReadAt ?? 0).getTime()
      );
    return inProgress[0] ?? null;
  }, [library.library]);

  /** Artwork for the ambient band behind the masthead: favourites lead. */
  const washCovers = useMemo(() => {
    const ranked = [...library.library].sort((a, b) => Number(b.favorite) - Number(a.favorite));
    return ranked
      .map((item) => item.manga.coverImage)
      .filter((uri): uri is string => !!uri)
      .slice(0, 6);
  }, [library.library]);

  /** Series in flight, shown as a shelf strip at the foot of the Sources tab. */
  const readingNow = useMemo(
    () =>
      library.library
        .filter((item) => item.status === 'reading')
        .slice(0, 8)
        .map((item) => ({
          id: item._id,
          uri: item.manga.coverImage,
          title: cleanMangaTitle(item.manga.title),
          accent: sourceOf(item)?.color,
        })),
    [library.library]
  );

  const emptyCopy = () => {
    if (library.searchQuery.trim() !== '') {
      return {
        headline: `Nothing matches "${library.searchQuery.trim()}"`,
        action: 'Try part of the title, or clear the search to see everything.',
      };
    }
    if (library.selectedType !== 'all') {
      return {
        headline: `No ${library.selectedType} in your library`,
        action: 'Switch the format filter back to All, or add a series from a source.',
      };
    }
    if (library.selectedCategory !== 'all') {
      return {
        headline: 'This shelf is empty',
        action: 'Move a series here from its options menu, or pick another shelf.',
      };
    }
    return {
      headline: 'Your library starts here',
      action: 'Open a source, find a series, and add it while you read.',
    };
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.gutter }}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.gutter} />

      {/* A dimmed band of the reader's own covers sits behind the whole header,
          so the top of the screen carries their collection rather than stock art. */}
      <CoverWash uris={washCovers} height={250} opacity={0.34} />

      {/* Masthead */}
      <View style={{ paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <Text style={[type.display, { fontSize: 34, textTransform: 'uppercase' }]}>
                UniManga
              </Text>
              <View
                style={{ width: 8, height: 8, backgroundColor: colors.accent, marginLeft: 4, marginBottom: 7 }}
              />
            </View>
            <Data style={{ marginTop: 4 }}>
              {stats.series} SERIES · {stats.reading} READING · {stats.chapters} CH READ
            </Data>
          </View>

          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity
              onPress={toggle}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={
                scheme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'
              }
              style={{
                width: 38,
                height: 38,
                backgroundColor: colors.panelRaised,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 6,
              }}
            >
              <Ionicons
                name={scheme === 'dark' ? 'sunny-outline' : 'moon-outline'}
                size={18}
                color={colors.paper}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/(main)/history')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Reading history"
              style={{
                width: 38,
                height: 38,
                backgroundColor: colors.panelRaised,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 6,
              }}
            >
              <Ionicons name="time-outline" size={18} color={colors.paper} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/(main)/profile')}
              activeOpacity={0.85}
