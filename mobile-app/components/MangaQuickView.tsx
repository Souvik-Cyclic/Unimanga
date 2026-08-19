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
                <TouchableOpacity onPress={() => onOpenUrl(manga.sourceUrl)} activeOpacity={0.7}>
                  <Data size={12} color={colors.accent} style={{ marginTop: 8 }}>
                    {hostname}
                  </Data>
                </TouchableOpacity>
              </View>
            </View>

            {/* Progress row */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 12,
                borderTopWidth: 1,
                borderTopColor: colors.edge,
                borderStyle: 'dashed',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="bookmark-outline" size={16} color={colors.accent} style={{ marginRight: 10 }} />
                <Text style={[type.body, { fontSize: 14, fontWeight: '700' }]}>
                  {currentChapter && currentChapter !== '0' ? `Ch.${currentChapter}` : 'Not started'}
                </Text>
              </View>
              {!!lastReadAt && (
                <Data size={11} color={colors.toneDim}>
                  {formatRelativeTime(lastReadAt)}
                </Data>
              )}
            </View>

            {/* Shelf / status row */}
            {!!categoryName && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderTopWidth: 1,
                  borderTopColor: colors.edge,
                  borderStyle: 'dashed',
                }}
              >
                <Ionicons name="folder-outline" size={16} color={colors.gold} style={{ marginRight: 10 }} />
                <Text style={[type.body, { fontSize: 14, fontWeight: '700' }]}>{categoryName}</Text>
              </View>
            )}

            {/* Chapters link + continue CTA */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 20,
                borderTopWidth: 1,
                borderTopColor: colors.edge,
                borderStyle: 'dashed',
                marginTop: 4,
              }}
            >
              <TouchableOpacity
                onPress={() => onOpenUrl(manga.sourceUrl)}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <Ionicons name="list-outline" size={15} color={colors.tone} style={{ marginRight: 6 }} />
                <Text style={[type.body, { fontSize: 13, fontWeight: '700', color: colors.tone }]}>
                  Chapters
                </Text>
              </TouchableOpacity>

              {!!continueTarget && (
                <TouchableOpacity
                  onPress={() => onOpenUrl(continueTarget.url)}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: colors.accent,
                    paddingHorizontal: 24,
                    paddingVertical: 13,
                    borderRadius: 999,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: type.display.fontFamily,
                      fontSize: 14,
                      fontWeight: '900',
                      letterSpacing: 0.5,
                      color: '#FFFFFF',
                    }}
                  >
                    Ch.{continueTarget.chapterLabel}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
