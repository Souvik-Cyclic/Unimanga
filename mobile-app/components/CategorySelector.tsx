import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Category, apiService } from '../services/api.service';
import { Data, EmptyState, Field, GhostButton, PrimaryButton, Sheet } from './ui';
import { useTheme } from '../constants/ThemeContext';
import { Toast, useToast } from './Toast';

// Categories still carry an emoji in their `icon` field (seeded server-side,
// see backend/controllers/category.controller.js), but rendering that
// glyph directly reads as a placeholder rather than real UI. Map the known
// default shelves to proper outline icons that match the app's visual
// language elsewhere (e.g. ReaderOverlay's status dots); anything else
// (a user-created custom shelf) falls back to a generic bookshelf icon
// instead of showing raw emoji text.
const SHELF_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Reading: 'book-outline',
  'Plan to Read': 'bookmark-outline',
  Completed: 'checkmark-circle-outline',
  'On Hold': 'pause-circle-outline',
  Dropped: 'close-circle-outline',
};
const DEFAULT_SHELF_ICON: keyof typeof Ionicons.glyphMap = 'library-outline';

interface CategorySelectorProps {
  visible: boolean;
  categories: Category[];
  loading: boolean;
  onSelect: (categoryId: string) => void;
  onClose: () => void;
  onCategoryCreated?: () => void;
}

export default function CategorySelector({
  visible,
  categories,
  loading,
  onSelect,
  onClose,
  onCategoryCreated,
}: CategorySelectorProps) {
  const { colors, type } = useTheme();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creating, setCreating] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      showToast('Give the shelf a name', 'error');
      return;
    }

    try {
      setCreating(true);
      await apiService.createCategory({ name: newCategoryName.trim() });
      setNewCategoryName('');
      setShowCreateForm(false);
      onCategoryCreated?.();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Could not create the shelf', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Sheet
        visible={visible}
        onClose={onClose}
        eyebrow="Add to library"
        title={showCreateForm ? 'New shelf' : 'Choose a shelf'}
        maxHeight="80%"
      >
        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Data style={{ marginTop: 14 }}>LOADING SHELVES</Data>
          </View>
        ) : showCreateForm ? (
          <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
            <Field
              label="Shelf name"
              placeholder="Weekly, Cultivation, Finished…"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoFocus
              editable={!creating}
            />
            <View style={{ flexDirection: 'row' }}>
              <GhostButton
                label="Cancel"
                onPress={() => {
                  setShowCreateForm(false);
                  setNewCategoryName('');
                }}
                disabled={creating}
                style={{ flex: 1, marginRight: 3 }}
              />
              <PrimaryButton
                label="Create shelf"
                onPress={handleCreateCategory}
                loading={creating}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : categories.length === 0 ? (
          <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
            <EmptyState
              headline="No shelves yet"
              action="Create one to file this series under."
            />
            <PrimaryButton label="Create a shelf" onPress={() => setShowCreateForm(true)} />
          </View>
        ) : (
          <>
            <ScrollView style={{ paddingHorizontal: 20 }}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category._id}
                  onPress={() => onSelect(category._id)}
                  activeOpacity={0.85}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.panelRaised,
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                    marginBottom: 3,
                    borderLeftWidth: 4,
                    borderLeftColor: category.color || colors.edge,
                  }}
                >
                  <Ionicons
                    name={SHELF_ICONS[category.name] ?? DEFAULT_SHELF_ICON}
                    size={18}
                    color={category.color || colors.tone}
                    style={{ marginRight: 10 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[type.body, { fontWeight: '600', fontSize: 15 }]}>
                      {category.name}
                    </Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={colors.tone} />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
              <TouchableOpacity
                onPress={() => setShowCreateForm(true)}
                activeOpacity={0.8}
                style={{ alignItems: 'center', paddingVertical: 10 }}
              >
                <Data size={12} color={colors.accent}>
                  + NEW SHELF
                </Data>
              </TouchableOpacity>
              <GhostButton label="Cancel" onPress={onClose} />
            </View>
          </>
        )}
      </Sheet>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </>
  );
}
