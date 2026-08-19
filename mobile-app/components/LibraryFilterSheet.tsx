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
    setSortBy('recent');
  };

  const isDefault = selectedCategory === 'all' && selectedType === 'all' && sortBy === 'recent';

  return (
    <Sheet visible={visible} onClose={onClose} eyebrow="Library" title="Filter & sort" maxHeight="80%">
      <ScrollView style={{ paddingHorizontal: 20 }}>
        <Eyebrow style={{ marginBottom: 8 }}>Shelf</Eyebrow>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 22 }}>
          <Chip
            label="All"
            count={totalCount}
            active={selectedCategory === 'all'}
            onPress={() => setSelectedCategory('all')}
          />
          {categories.map((category) => (
            <Chip
              key={category._id}
              label={category.name}
              count={getCategoryCount(category._id)}
              active={selectedCategory === category._id}
              onPress={() => setSelectedCategory(category._id)}
            />
          ))}
        </ScrollView>

        <Eyebrow style={{ marginBottom: 8 }}>Format</Eyebrow>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 22 }}>
          {FORMAT_OPTIONS.map((format) => (
            <Chip
              key={format}
              label={format === 'all' ? 'All' : format.charAt(0).toUpperCase() + format.slice(1)}
              active={selectedType === format}
              onPress={() => setSelectedType(format)}
            />
          ))}
        </ScrollView>

        <Eyebrow style={{ marginBottom: 8 }}>Order</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
          {SORT_OPTIONS.map((sort) => (
            <View key={sort.key} style={{ marginBottom: 8 }}>
              <Chip label={sort.label} active={sortBy === sort.key} onPress={() => setSortBy(sort.key)} />
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}>
        <GhostButton
          label="Reset"
          onPress={handleReset}
          disabled={isDefault}
          tone={isDefault ? colors.toneDim : colors.accent}
        />
      </View>
    </Sheet>
  );
}
