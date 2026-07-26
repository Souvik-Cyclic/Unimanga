import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/auth.service';
import { useTheme } from '../../constants/ThemeContext';
import { Toast, useToast } from '../../components/Toast';
import { Data, Eyebrow, Field, GhostButton, PrimaryButton, Sheet } from '../../components/ui';

/** A titled block of settings. Every section on this screen uses one. */
function Section({
  title,
  action,
  children,
  accent,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  accent?: string;
}) {
  const { colors, type } = useTheme();

  return (
    <View style={{ marginBottom: 3, backgroundColor: colors.panel, borderLeftWidth: 4, borderLeftColor: accent ?? colors.edge }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 12,
        }}
      >
        <Text style={[type.title, { fontSize: 17, textTransform: 'uppercase', letterSpacing: 0.6 }]}>
          {title}
        </Text>
        {action}
      </View>
      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>{children}</View>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const logout = useAuthStore((state) => state.logout);
  const { toast, showToast, hideToast } = useToast();
  const { colors, type, scheme, preference, setPreference } = useTheme();

  const [editingProfile, setEditingProfile] = useState(false);
  const [username, setUsername] = useState(user?.username ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleStartEditProfile = () => {
    setUsername(user?.username ?? '');
    setEmail(user?.email ?? '');
    setEditingProfile(true);
  };

  const handleCancelEditProfile = () => {
    setEditingProfile(false);
    setUsername(user?.username ?? '');
    setEmail(user?.email ?? '');
  };

  const handleSaveProfile = async () => {
    if (!username.trim() || !email.trim()) {
      showToast('Username and email cannot be empty', 'error');
      return;
    }

    try {
      setSavingProfile(true);
      const response = await authService.updateProfile({
        username: username.trim(),
        email: email.trim(),
      });
      updateUser({
        username: response.user.username,
        email: response.user.email,
      });
      setEditingProfile(false);
      showToast('Profile updated', 'success');
    } catch (error) {
      showToast(typeof error === 'string' ? error : 'Could not update the profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast('Fill in all three password fields', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('The two new passwords do not match', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Use at least 6 characters for the new password', 'error');
      return;
    }

    try {
      setChangingPassword(true);
      await authService.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password changed', 'success');
    } catch (error) {
      showToast(typeof error === 'string' ? error : 'Could not change the password', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      showToast('Enter your password to confirm', 'error');
      return;
    }

    try {
      setDeletingAccount(true);
      await authService.deleteAccount(deletePassword);
      setConfirmingDelete(false);
      setShowDeleteModal(false);
      await logout();
      router.replace('/(auth)/login');
    } catch (error) {
      setConfirmingDelete(false);
      showToast(typeof error === 'string' ? error : 'Could not delete the account', 'error');
    } finally {
      setDeletingAccount(false);
    }
  };

  const initial = (user?.username ?? '?').charAt(0).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: colors.gutter }}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.gutter} />

      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.85}
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
        <Text style={[type.display, { fontSize: 26, textTransform: 'uppercase' }]}>Account</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
          {/* Identity card */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.panel,
              padding: 16,
              marginBottom: 3,
            }}
          >
            <View
              style={{
                width: 54,
                height: 54,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 14,
              }}
            >
              <Text style={[type.display, { fontSize: 26, color: '#FFFFFF' }]}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.display, { fontSize: 21 }]} numberOfLines={1}>
                {user?.username}
              </Text>
              <Data size={11} style={{ marginTop: 3 }}>
                {user?.email?.toUpperCase()}
              </Data>
            </View>
          </View>

          <Section title="Appearance">
            <Text style={[type.body, { color: colors.tone, marginBottom: 14 }]}>
              Ink on a dark page, ink on paper, or whatever your phone is set to.
            </Text>
            <View style={{ flexDirection: 'row' }}>
              {([
                { key: 'light', label: 'Light', icon: 'sunny-outline' as const },
                { key: 'dark', label: 'Dark', icon: 'moon-outline' as const },
                { key: 'system', label: 'System', icon: 'phone-portrait-outline' as const },
              ] as const).map((option, index) => {
                const selected = preference === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => setPreference(option.key)}
                    activeOpacity={0.85}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={{
                      flex: 1,
                      marginLeft: index === 0 ? 0 : 3,
                      paddingVertical: 14,
                      alignItems: 'center',
                      backgroundColor: selected ? colors.paper : colors.panelRaised,
                    }}
                  >
                    <Ionicons
                      name={option.icon}
                      size={17}
                      color={selected ? colors.gutter : colors.tone}
                    />
