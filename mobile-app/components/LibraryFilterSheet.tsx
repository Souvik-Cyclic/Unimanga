import React from 'react';
import { View, ScrollView } from 'react-native';
import { Category } from '../services/api.service';
import { useTheme } from '../constants/ThemeContext';
import { Chip, Eyebrow, GhostButton, Sheet } from './ui';

type MangaFormat = 'all' | 'manga' | 'manhwa' | 'manhua';
type SortKey = 'recent' | 'title' | 'added' | 'progress';

interface LibraryFilterSheetProps {
  visible: boolean;
  onClose: () => void;

  totalCount: number;
  categories: Category[];
  selectedCategory: string;
  setSelectedCategory: (id: string) => void;
  getCategoryCount: (categoryId: string) => number;

  selectedType: MangaFormat;
  setSelectedType: (type: MangaFormat) => void;

  sortBy: SortKey;
  setSortBy: (sort: SortKey) => void;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Last read' },
  { key: 'title', label: 'A–Z' },
  { key: 'added', label: 'Newest' },
  { key: 'progress', label: 'Furthest along' },
];

const FORMAT_OPTIONS: MangaFormat[] = ['all', 'manga', 'manhwa', 'manhua'];

/**
 * Every library filter (shelf, format, sort order) in one sheet, instead of
 * three permanently-visible horizontal chip rows eating the top of the
 * library screen before the reader even sees their books. Selections still
 * apply live the moment they're tapped - same behavior as the inline chips
 * they replace - this is just a picker, not a staged "Apply" form.
 */
export default function LibraryFilterSheet({
  visible,
  onClose,
  totalCount,
  categories,
  selectedCategory,
  setSelectedCategory,
  getCategoryCount,
  selectedType,
  setSelectedType,
  sortBy,
  setSortBy,
}: LibraryFilterSheetProps) {
  const { colors } = useTheme();

  const handleReset = () => {
    setSelectedCategory('all');
    setSelectedType('all');
