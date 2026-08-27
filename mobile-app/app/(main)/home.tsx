import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Image,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
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

      {/* Masthead. The top padding follows the device inset rather than a fixed
          value, so the wordmark clears tall status bars and notches. */}
      <View style={{ paddingHorizontal: 20, paddingTop: insets.top + 14, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <Image
                source={require('../../assets/logo.png')}
                style={{ width: 30, height: 30, marginRight: 8, marginBottom: 1 }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={[type.display, { fontSize: 34, textTransform: 'uppercase', flexShrink: 1 }]}
              >
                UniManga
              </Text>
              <View
                style={{ width: 8, height: 8, backgroundColor: colors.accent, marginLeft: 4, marginBottom: 7 }}
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexShrink: 0 }}>
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
              style={{
                width: 38,
                height: 38,
                backgroundColor: colors.panelRaised,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 6,
              }}
            >
              <Ionicons name="person-outline" size={18} color={colors.paper} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLogout}
              activeOpacity={0.85}
              style={{
                width: 38,
                height: 38,
                backgroundColor: colors.panelRaised,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="log-out-outline" size={18} color={colors.tone} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats sit under the row, at full width, so a long count cannot
            squeeze the wordmark or wrap onto a second line. */}
        <Data style={{ marginTop: 6 }}>
          {stats.series} SERIES · {stats.reading} READING · {stats.chapters} CH READ
        </Data>
      </View>

      {/* Tab switcher — two hard panels, no gap between them */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginBottom: 14 }}>
        {(['library', 'sources'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.85}
            style={{
              flex: 1,
              paddingVertical: 12,
              alignItems: 'center',
              backgroundColor: activeTab === tab ? colors.paper : colors.panelRaised,
            }}
          >
            <Text
              style={{
                fontFamily: type.display.fontFamily,
                fontSize: 13,
                fontWeight: '900',
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                color: activeTab === tab ? colors.gutter : colors.tone,
              }}
            >
              {tab === 'library' ? 'My library' : 'Sources'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {activeTab === 'sources' ? (
          <View style={{ paddingHorizontal: 20 }}>
            <Eyebrow style={{ marginBottom: 10 }}>Read from</Eyebrow>

            {loadingWebsites ? (
              <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Data style={{ marginTop: 14 }}>LOADING SOURCES</Data>
              </View>
            ) : websites.length === 0 ? (
              <EmptyState
                headline="No sources configured"
                action="Sources come from the server. Pull down to check again."
              />
            ) : (
              websites.map((source) => (
                <TouchableOpacity
                  key={source._id}
                  onPress={() => handleOpenWebsite(source)}
                  activeOpacity={0.85}
                  style={{ marginBottom: 3 }}
                >
                  <View style={{ flexDirection: 'row', backgroundColor: colors.panel }}>
                    {/* Source mark: the site's real favicon, falling back to
                        its initial on its own colour if none loads. */}
                    <SiteIcon url={source.url} name={source.name} color={source.color} size={58} />

                    <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 14 }}>
                      <Text style={[type.title, { fontSize: 17 }]}>{source.name}</Text>
                      <Data style={{ marginTop: 3 }} size={11}>
                        {source.language.toUpperCase()} · {source.url.replace('https://', '')}
                      </Data>
                    </View>

                    <View style={{ justifyContent: 'center', paddingRight: 14 }}>
                      <Ionicons name="arrow-forward" size={18} color={colors.tone} />
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}

            {readingNow.length > 0 && (
              <View style={{ marginTop: 28 }}>
                <Eyebrow style={{ marginBottom: 10 }}>Currently reading</Eyebrow>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <CoverStrip
                    items={readingNow}
                    onPress={(id) => {
                      const item = library.library.find((entry) => entry._id === id);
                      if (item) setQuickViewItem(item);
                    }}
                  />
                </ScrollView>
              </View>
            )}

            {/* Screentone fills the tail of the page the way a manga panel would */}
            <Halftone style={{ marginTop: 36, alignItems: 'center' }} rows={5} columns={11} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            {/* Continue reading — the one panel that gets cover bleed */}
            {isUnfiltered && continueItem && (
              <View style={{ marginBottom: 22 }}>
                <Eyebrow style={{ marginBottom: 8 }}>Pick up where you left off</Eyebrow>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setQuickViewItem(continueItem)}
                  style={{ backgroundColor: colors.panel }}
                >
                  <View style={{ flexDirection: 'row' }}>
                    <Cover
                      uri={continueItem.manga.coverImage}
                      title={cleanMangaTitle(continueItem.manga.title)}
                      width={104}
                      height={148}
                      accent={sourceOf(continueItem)?.color}
                    />

                    <View style={{ flex: 1, padding: 14, justifyContent: 'space-between' }}>
                      <View>
                        <Text style={[type.display, { fontSize: 22 }]} numberOfLines={2}>
                          {cleanMangaTitle(continueItem.manga.title)}
                        </Text>
                        <Data style={{ marginTop: 6 }}>
                          {formatChapterDisplay(continueItem.currentChapter).toUpperCase()}
                          {continueItem.manga.totalChapters
                            ? ` / ${continueItem.manga.totalChapters}`
                            : ''}
                        </Data>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="play" size={13} color={colors.accent} />
                        <Text
                          style={{
                            fontFamily: type.display.fontFamily,
                            fontSize: 13,
                            fontWeight: '900',
                            letterSpacing: 1.2,
                            textTransform: 'uppercase',
                            color: colors.accent,
                            marginLeft: 6,
                          }}
                        >
                          Resume
                        </Text>
                      </View>
                    </View>
                  </View>
                  <ProgressRule percent={progressOf(continueItem)} height={4} />
                </TouchableOpacity>
              </View>
            )}

            {/* Search */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.panelRaised,
                paddingHorizontal: 12,
                marginBottom: 14,
              }}
            >
              <Ionicons name="search" size={16} color={colors.toneDim} />
              <TextInput
                value={library.searchQuery}
                onChangeText={library.setSearchQuery}
                placeholder="Search titles"
                placeholderTextColor={colors.toneDim}
                style={{
                  flex: 1,
                  color: colors.paper,
                  fontFamily: type.body.fontFamily,
                  fontSize: 15,
                  paddingHorizontal: 10,
                  paddingVertical: 12,
                }}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {library.searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => library.setSearchQuery('')}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={16} color={colors.tone} />
                </TouchableOpacity>
              )}
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <TouchableOpacity
                onPress={() => setShowFilterSheet(true)}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  height: 28,
                  backgroundColor: activeFilterCount > 0 ? colors.paper : colors.panelRaised,
                }}
              >
                <Ionicons
                  name="options-outline"
                  size={14}
                  color={activeFilterCount > 0 ? colors.gutter : colors.tone}
                  style={{ marginRight: 6 }}
                />
                <Data size={12} color={activeFilterCount > 0 ? colors.gutter : colors.tone}>
                  FILTER{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </Data>
              </TouchableOpacity>

              <Data>
                SHOWING {library.filteredLibrary.length} OF {library.library.length}
              </Data>

              <View style={{ flexDirection: 'row' }}>
                {([
                  { key: 'list', icon: 'list-outline' as const, label: 'List view' },
                  { key: 'gallery', icon: 'grid-outline' as const, label: 'Gallery view' },
                ] as const).map((option) => {
                  const active = library.viewMode === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      onPress={() => library.setViewMode(option.key)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={option.label}
                      accessibilityState={{ selected: active }}
                      style={{
                        width: 32,
                        height: 28,
                        marginLeft: 3,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: active ? colors.paper : colors.panelRaised,
                      }}
                    >
                      <Ionicons
                        name={option.icon}
                        size={15}
                        color={active ? colors.gutter : colors.tone}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {library.loading ? (
              <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Data style={{ marginTop: 14 }}>LOADING LIBRARY</Data>
              </View>
            ) : library.filteredLibrary.length === 0 ? (
              <View style={{ alignItems: 'center' }}>
                <EmptyState {...emptyCopy()} />
                <Halftone style={{ marginTop: 8 }} rows={4} columns={9} />
              </View>
            ) : library.viewMode === 'gallery' ? (
              /* Gallery: covers first, three to a row, with the chapter figure
                 kept underneath so the shelf is still scannable. */
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -2 }}>
                {library.filteredLibrary.map((item) => {
                  const source = sourceOf(item);
                  const spine = source?.color ?? colors.edge;
                  const percent = progressOf(item);

                  return (
                    <TouchableOpacity
                      key={item._id}
                      activeOpacity={0.9}
                      onPress={() => setQuickViewItem(item)}
                      onLongPress={() => mangaMenu.openOptionsMenu(item)}
                      style={{ width: '33.333%', padding: 2 }}
                    >
                      <View style={{ backgroundColor: colors.panel }}>
                        <View>
                          <Cover
                            uri={item.manga.coverImage}
                            title={cleanMangaTitle(item.manga.title)}
                            height={160}
                          />
                          {item.favorite && (
                            <View
                              style={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                backgroundColor: 'rgba(0,0,0,0.55)',
                                padding: 3,
                              }}
                            >
                              <Ionicons name="star" size={13} color={colors.gold} />
                            </View>
                          )}
                        </View>

                        <ProgressRule percent={percent} color={spine} />

                        <View style={{ paddingHorizontal: 6, paddingVertical: 7 }}>
                          <Text style={[type.title, { fontSize: 12 }]} numberOfLines={2}>
                            {cleanMangaTitle(item.manga.title)}
                          </Text>
                          <Data size={10} style={{ marginTop: 3 }}>
                            {item.currentChapter === '0'
                              ? 'NOT STARTED'
                              : `CH ${item.currentChapter}`}
                            {item.manga.totalChapters ? ` / ${item.manga.totalChapters}` : ''}
                          </Data>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              library.filteredLibrary.map((item) => {
                const source = sourceOf(item);
                const spine = source?.color ?? colors.edge;
                const percent = progressOf(item);
                const status = statusMeta[item.status] ?? statusMeta.reading;

                return (
                  <TouchableOpacity
                    key={item._id}
                    activeOpacity={0.9}
                    onPress={() => setQuickViewItem(item)}
                    onLongPress={() => mangaMenu.openOptionsMenu(item)}
                    style={{ marginBottom: 3, backgroundColor: colors.panel }}
                  >
                    <View style={{ flexDirection: 'row' }}>
                      {/* Spine: the source the series is read from, as a book spine */}
                      <View style={{ width: 5, backgroundColor: spine }} />

                      <Cover
                        uri={item.manga.coverImage}
                        title={cleanMangaTitle(item.manga.title)}
                        width={62}
                        height={92}
                        accent={spine}
                      />

                      <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                          <Text style={[type.title, { fontSize: 16, flex: 1 }]} numberOfLines={2}>
                            {cleanMangaTitle(item.manga.title)}
                          </Text>
                          <TouchableOpacity
                            onPress={() => handleToggleFavorite(item)}
                            activeOpacity={0.7}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={{ paddingLeft: 8 }}
                          >
                            <Ionicons
                              name={item.favorite ? 'star' : 'star-outline'}
                              size={17}
                              color={item.favorite ? colors.gold : colors.toneDim}
                            />
                          </TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                          <View
                            style={{
                              width: 6,
                              height: 6,
                              backgroundColor: status.color,
                              marginRight: 6,
                            }}
                          />
                          <Data size={11}>{status.label.toUpperCase()}</Data>
                          {/* Second fact is whichever the status does not already say:
                              the shelf when it differs, otherwise the source site. */}
                          <Data size={11} color={colors.toneDim} style={{ marginHorizontal: 6 }}>
                            ·
                          </Data>
                          <Data size={11}>
                            {(item.category?.name?.toLowerCase() === status.label.toLowerCase()
                              ? source?.name ?? item.category?.name
                              : item.category?.name
                            )?.toUpperCase()}
                          </Data>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Data size={12} color={colors.paper}>
                            {formatChapterDisplay(item.currentChapter).toUpperCase()}
                            {item.manga.totalChapters ? ` / ${item.manga.totalChapters}` : ''}
                          </Data>
                          {percent > 0 && (
                            <Data size={11} color={colors.tone}>
                              {percent}%
                            </Data>
                          )}
                        </View>
                      </View>
                    </View>
                    <ProgressRule percent={percent} color={spine} />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Series options */}
      <Sheet
        visible={mangaMenu.showOptionsMenu && !showEditProgress}
        onClose={mangaMenu.closeOptionsMenu}
        eyebrow="Series options"
        title={
          mangaMenu.selectedManga
            ? cleanMangaTitle(mangaMenu.selectedManga.manga.title)
            : ''
        }
      >
        <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          {[
            { icon: 'albums-outline' as const, label: 'Move to another shelf', onPress: mangaMenu.openCategoryModal, tone: colors.paper },
            { icon: 'create-outline' as const, label: 'Set current chapter', onPress: handleOpenEditProgress, tone: colors.paper },
            { icon: 'trash-outline' as const, label: 'Remove from library', onPress: handleDeleteManga, tone: colors.danger },
          ].map((option) => (
            <TouchableOpacity
              key={option.label}
              onPress={option.onPress}
              activeOpacity={0.85}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.panelRaised,
                paddingHorizontal: 14,
                paddingVertical: 15,
                marginBottom: 3,
              }}
            >
              <Ionicons name={option.icon} size={18} color={option.tone} />
              <Text style={[type.body, { color: option.tone, marginLeft: 12, fontWeight: '600' }]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}

          <GhostButton label="Close" onPress={mangaMenu.closeOptionsMenu} style={{ marginTop: 12 }} />
        </View>
      </Sheet>

      {/* Shelf picker */}
      <Sheet
        visible={mangaMenu.showCategoryModal}
        onClose={mangaMenu.closeCategoryModal}
        eyebrow="Move to"
        title="Choose a shelf"
        maxHeight="80%"
      >
        <ScrollView style={{ paddingHorizontal: 20 }}>
          {library.categories.map((category) => {
            const selected = mangaMenu.selectedManga?.category?._id === category._id;
            return (
              <TouchableOpacity
                key={category._id}
                onPress={() => handleCategorySelect(category._id)}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: colors.panelRaised,
                  paddingHorizontal: 14,
                  paddingVertical: 15,
                  marginBottom: 3,
                  borderLeftWidth: 4,
                  borderLeftColor: category.color || colors.edge,
                }}
              >
                <Text style={[type.body, { fontWeight: '600' }]}>{category.name}</Text>
                {selected && <Ionicons name="checkmark" size={18} color={colors.accent} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
          <GhostButton label="Cancel" onPress={mangaMenu.closeCategoryModal} />
        </View>
      </Sheet>

      {/* Remove confirmation */}
      <Sheet
        visible={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        eyebrow="Remove series"
        title={
          mangaMenu.selectedManga
            ? cleanMangaTitle(mangaMenu.selectedManga.manga.title)
            : ''
        }
      >
        <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          <Text style={[type.body, { color: colors.tone, lineHeight: 21, marginBottom: 20 }]}>
            This clears the series and your saved chapter progress from your library. The series
            stays available from its source.
          </Text>
          <View style={{ flexDirection: 'row' }}>
            <GhostButton label="Keep it" onPress={() => setShowDeleteConfirm(false)} style={{ flex: 1, marginRight: 3 }} />
            <TouchableOpacity
              onPress={() => {
                setShowDeleteConfirm(false);
                deleteCallback?.();
              }}
              activeOpacity={0.85}
              style={{
                flex: 1,
                backgroundColor: colors.danger,
                paddingVertical: 15,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: type.display.fontFamily,
                  fontSize: 15,
                  fontWeight: '900',
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  color: colors.gutter,
                }}
              >
                Remove
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Sheet>

      {/* Chapter correction */}
      <Sheet
        visible={showEditProgress}
        onClose={handleCloseEditProgress}
        eyebrow="Set current chapter"
        title={
          mangaMenu.selectedManga
            ? cleanMangaTitle(mangaMenu.selectedManga.manga.title)
            : ''
        }
      >
        <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          <Field
            label="Chapter"
            value={editProgressValue}
            onChangeText={setEditProgressValue}
            placeholder="194 or 45.5"
            keyboardType="decimal-pad"
            hint="Whole or half chapters, e.g. 45.5"
            error={
              editProgressValue.trim().length > 0 && !isValidProgressValue(editProgressValue)
                ? 'Enter a chapter number, like 194 or 45.5'
                : undefined
            }
          />
          <View style={{ flexDirection: 'row' }}>
            <GhostButton label="Cancel" onPress={handleCloseEditProgress} style={{ flex: 1, marginRight: 3 }} />
            <PrimaryButton
              label="Save chapter"
              onPress={handleSaveProgress}
              loading={savingProgress}
              disabled={!isValidProgressValue(editProgressValue)}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </Sheet>

      <LibraryFilterSheet
        visible={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        totalCount={library.library.length}
        categories={library.categories}
        selectedCategory={library.selectedCategory}
        setSelectedCategory={library.setSelectedCategory}
        getCategoryCount={library.getCategoryCount}
        selectedType={library.selectedType}
        setSelectedType={library.setSelectedType}
        sortBy={library.sortBy}
        setSortBy={library.setSortBy}
      />

      <MangaQuickView
        visible={!!quickViewItem}
        manga={quickViewItem?.manga ?? null}
        currentChapter={quickViewItem?.currentChapter ?? '0'}
        lastReadUrl={quickViewItem?.lastReadUrl}
        lastReadAt={quickViewItem?.lastReadAt}
        categoryName={quickViewItem?.category?.name}
        onClose={() => setQuickViewItem(null)}
        onOpenUrl={(url) => {
          if (!quickViewItem) return;
          const item = quickViewItem;
          setQuickViewItem(null);
          handleOpenManga(item, url);
        }}
      />

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
      />
    </View>
  );
}
