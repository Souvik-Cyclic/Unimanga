import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Manga } from '../services/api.service';
import { cleanMangaTitle, formatRelativeTime } from '../utils/mangaHelpers';
import { resolveContinueTarget } from '../utils/continueReading';
import { useTheme } from '../constants/ThemeContext';
import { Cover, Data, Eyebrow } from './ui';

interface MangaQuickViewProps {
  visible: boolean;
  manga: Manga | null;
  currentChapter: string;
  lastReadUrl?: string;
  lastReadAt?: string;
  categoryName?: string;
  onClose: () => void;
  /** Navigate into the in-app browser at the given URL. */
  onOpenUrl: (url: string) => void;
}

/**
 * Quick-look panel opened from a tap on a library or history row - shows
 * where the reader is in a series and offers two ways forward: browse the
 * chapter list from the top of the detail page ("Chapters"), or jump
 * straight back in - either resuming the exact chapter last read, or, if a
 * newer one has been seen since, going straight to that instead (see
 * resolveContinueTarget - only some sites can construct that URL directly;
 * others fall back to the detail page for that same CTA).
 */
export default function MangaQuickView({
  visible,
  manga,
  currentChapter,
  lastReadUrl,
  lastReadAt,
  categoryName,
  onClose,
  onOpenUrl,
}: MangaQuickViewProps) {
  const { colors, type } = useTheme();

  const continueTarget = useMemo(() => {
    if (!manga) return null;
    return resolveContinueTarget(manga, currentChapter, lastReadUrl);
  }, [manga, currentChapter, lastReadUrl]);

  if (!visible || !manga) return null;

  const title = cleanMangaTitle(manga.title) || manga.title;
  const hostname = (() => {
    try {
      return new URL(manga.sourceUrl).hostname.replace(/^www\./, '');
    } catch {
      return manga.sourceUrl;
    }
  })();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />

        <View
          style={{
            backgroundColor: colors.panel,
            borderTopWidth: 3,
            borderTopColor: colors.accent,
          }}
          onStartShouldSetResponder={() => true}
        >
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            <View style={{ width: 44, height: 3, backgroundColor: colors.edge }} />
          </View>

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
            {/* Cover, title, source link */}
            <View style={{ flexDirection: 'row', marginBottom: 20, marginTop: 8 }}>
              <View style={{ marginRight: 14 }}>
                <Cover uri={manga.coverImage} title={title} width={80} height={114} />
              </View>

              <View style={{ flex: 1, paddingRight: 34, justifyContent: 'center' }}>
                <Text style={[type.display, { fontSize: 20 }]} numberOfLines={3}>
                  {title}
                </Text>
