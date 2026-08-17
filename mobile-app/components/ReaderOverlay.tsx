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
          borderTopWidth: 3,
          borderTopColor: colors.accent,
          maxHeight: '80%',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 12,
        }}
      >
        <View style={{ alignItems: 'center', paddingVertical: 10 }}>
          <View style={{ width: 44, height: 3, backgroundColor: colors.edge }} />
        </View>

        <ScrollView style={{ flex: 1 }}>
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.85}
            style={{
              position: 'absolute',
              top: 4,
              right: 16,
              zIndex: 10,
              width: 30,
              height: 30,
              backgroundColor: colors.panelRaised,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={16} color={colors.paper} />
          </TouchableOpacity>

          <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
            {/* Cover and identity */}
            <View style={{ flexDirection: 'row', marginBottom: 20, marginTop: 8 }}>
              <View style={{ marginRight: 14 }}>
                <Cover uri={metadata.coverImage} title={title} width={92} height={132} />
              </View>

              <View style={{ flex: 1, paddingRight: 34 }}>
                <Text style={[type.display, { fontSize: 22 }]} numberOfLines={3}>
                  {title}
                </Text>

                {!!metadata.author && (
                  <Data size={11} style={{ marginTop: 6 }}>
                    {metadata.author.toUpperCase()}
                  </Data>
                )}

                {!!metadata.mangaStatus && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        marginRight: 6,
                        backgroundColor: SERIES_STATUS[metadata.mangaStatus] ?? colors.accent,
                      }}
                    />
                    <Data size={11}>{metadata.mangaStatus.toUpperCase()}</Data>
                  </View>
                )}
              </View>
            </View>

            {/* Figures the reader compares before committing */}
            {(!!metadata.totalChapters || !!metadata.rating) && (
              <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                {!!metadata.totalChapters && metadata.totalChapters > 0 && (
                  <View style={{ flex: 1, backgroundColor: colors.panelRaised, padding: 12, marginRight: 3 }}>
                    <Eyebrow>Chapters</Eyebrow>
                    <Text style={[type.display, { fontSize: 24, marginTop: 2 }]}>
                      {metadata.totalChapters}
                    </Text>
                  </View>
                )}
                {!!metadata.rating && metadata.rating > 0 && (
                  <View style={{ flex: 1, backgroundColor: colors.panelRaised, padding: 12 }}>
                    <Eyebrow>Rating</Eyebrow>
                    <Text style={[type.display, { fontSize: 24, marginTop: 2 }]}>
                      {metadata.rating.toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {!!metadata.genres?.length && (
              <View style={{ marginBottom: 20 }}>
                <Eyebrow style={{ marginBottom: 8 }}>Genres</Eyebrow>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {metadata.genres.map((genre, index) => (
                    <View
                      key={`${genre}-${index}`}
                      style={{
                        backgroundColor: colors.panelRaised,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        marginRight: 3,
                        marginBottom: 3,
                      }}
                    >
                      <Data size={11}>{genre.toUpperCase()}</Data>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {!!metadata.description && (
              <View style={{ marginBottom: 20 }}>
                <Eyebrow style={{ marginBottom: 8 }}>Synopsis</Eyebrow>
                <Text style={[type.body, { color: colors.tone, lineHeight: 21 }]} numberOfLines={6}>
                  {metadata.description}
                </Text>
              </View>
            )}

            <View style={{ marginBottom: 22 }}>
              <Eyebrow style={{ marginBottom: 8 }}>Source</Eyebrow>
              <View style={{ backgroundColor: colors.panelRaised, padding: 12 }}>
                <Text style={[type.title, { fontSize: 15 }]}>{metadata.sourceWebsite}</Text>
                <Data size={10} color={colors.toneDim} style={{ marginTop: 4 }} >
                  {metadata.sourceUrl}
                </Data>
              </View>
            </View>

            {loadingCategories ? (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : (
              <PrimaryButton
                label="Add to library"
                onPress={handleAddToLibrary}
                loading={addingToLibrary}
              />
            )}
          </View>
        </ScrollView>
      </View>

      <CategorySelector
        visible={showCategorySelector}
        categories={categories}
        loading={loadingCategories}
        onSelect={handleCategorySelect}
        onClose={() => setShowCategorySelector(false)}
        onCategoryCreated={loadCategories}
      />

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </>
  );
}
