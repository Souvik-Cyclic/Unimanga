import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  SectionList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { apiService, ReadHistoryEntry } from '../../services/api.service';
import { cleanMangaTitle } from '../../utils/mangaHelpers';
import { Toast, useToast } from '../../components/Toast';
import { useTheme } from '../../constants/ThemeContext';
import { Cover, Data, EmptyState, GhostButton, Halftone, Sheet } from '../../components/ui';
import MangaQuickView from '../../components/MangaQuickView';

/** Entries are grouped by the day they were read. */
interface DaySection {
  title: string;
  data: ReadHistoryEntry[];
}

/** "Today", "Yesterday", then the date itself. */
function dayLabel(when: Date): string {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfEntry = new Date(when.getFullYear(), when.getMonth(), when.getDate());
  const days = Math.round((startOfToday.getTime() - startOfEntry.getTime()) / 86400000);

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return when.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function clockTime(when: Date): string {
  return when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function HistoryScreen() {
  const router = useRouter();
  const { colors, type, scheme } = useTheme();
  const { toast, showToast, hideToast } = useToast();

  const [sections, setSections] = useState<DaySection[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [quickViewEntry, setQuickViewEntry] = useState<ReadHistoryEntry | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const { history, total: totalEntries } = await apiService.getHistory();
      // Group into days while preserving the newest-first order the API returns.
      const grouped: DaySection[] = [];
      history.forEach((entry) => {
        const label = dayLabel(new Date(entry.readAt));
        const open = grouped[grouped.length - 1];
        if (open && open.title === label) {
          open.data.push(entry);
        } else {
          grouped.push({ title: label, data: [entry] });
        }
      });
      setSections(grouped);
      setTotal(totalEntries);
    } catch (error) {
      showToast('Could not load your history', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const handleOpen = (entry: ReadHistoryEntry, urlOverride?: string) => {
    const website =
      typeof entry.manga.sourceWebsite === 'object' ? entry.manga.sourceWebsite : null;

    router.push({
      pathname: '/(main)/browser',
      params: {
        name: website?.name || 'Manga',
        url: urlOverride || entry.chapterUrl || entry.manga.sourceUrl,
        color: website?.color || colors.accent,
        mangaId: entry.manga._id,
        ...(entry.userManga ? { userMangaId: entry.userManga } : {}),
      },
    });
  };

  const handleRemove = async (entry: ReadHistoryEntry) => {
    try {
      await apiService.deleteHistoryEntry(entry._id);
      await loadHistory();
      showToast('Entry removed', 'success');
    } catch (error) {
      showToast('Could not remove that entry', 'error');
    }
  };

  const handleClear = async () => {
    try {
      setClearing(true);
      const removed = await apiService.clearHistory();
      setShowClearConfirm(false);
      await loadHistory();
      showToast(`Cleared ${removed} ${removed === 1 ? 'entry' : 'entries'}`, 'success');
    } catch (error) {
      showToast('Could not clear your history', 'error');
    } finally {
      setClearing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.gutter }}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.gutter}
      />

      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 52,
          paddingBottom: 16,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{
            width: 38,
            height: 38,
            backgroundColor: colors.panelRaised,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Ionicons name="arrow-back" size={18} color={colors.paper} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={[type.display, { fontSize: 26, textTransform: 'uppercase' }]}>History</Text>
          <Data size={11} style={{ marginTop: 2 }}>
            {total} {total === 1 ? 'CHAPTER' : 'CHAPTERS'} READ
          </Data>
        </View>

        {total > 0 && (
