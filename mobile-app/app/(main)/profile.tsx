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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();

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
      <View style={{ paddingHorizontal: 20, paddingTop: insets.top + 14, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
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
                    <Text
                      style={{
                        fontFamily: type.display.fontFamily,
                        fontSize: 12,
                        fontWeight: '800',
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                        marginTop: 6,
                        color: selected ? colors.gutter : colors.tone,
                      }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {preference === 'system' && (
              <Data size={11} style={{ marginTop: 10 }}>
                FOLLOWING YOUR PHONE · CURRENTLY {scheme.toUpperCase()}
              </Data>
            )}
          </Section>

          <Section
            title="Profile"
            action={
              !editingProfile ? (
                <TouchableOpacity onPress={handleStartEditProfile} activeOpacity={0.8}>
                  <Data size={12} color={colors.accent}>
                    EDIT
                  </Data>
                </TouchableOpacity>
              ) : undefined
            }
          >
            {editingProfile ? (
              <>
                <Field
                  label="Username"
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Username"
                  autoCapitalize="none"
                />
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <View style={{ flexDirection: 'row' }}>
                  <GhostButton
                    label="Cancel"
                    onPress={handleCancelEditProfile}
                    disabled={savingProfile}
                    style={{ flex: 1, marginRight: 3 }}
                  />
                  <PrimaryButton
                    label="Save changes"
                    onPress={handleSaveProfile}
                    loading={savingProfile}
                    style={{ flex: 1 }}
                  />
                </View>
              </>
            ) : (
              <>
                <Eyebrow>Username</Eyebrow>
                <Text style={[type.body, { fontSize: 15, marginTop: 4, marginBottom: 14 }]}>
                  {user?.username}
                </Text>
                <Eyebrow>Email</Eyebrow>
                <Text style={[type.body, { fontSize: 15, marginTop: 4 }]}>{user?.email}</Text>
              </>
            )}
          </Section>

          <Section title="Password">
            <Field
              label="Current password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Your password right now"
              secureTextEntry
            />
            <Field
              label="New password"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 6 characters"
              secureTextEntry
            />
            <Field
              label="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Type it again"
              secureTextEntry
              error={
                confirmPassword.length > 0 && newPassword !== confirmPassword
                  ? 'The two new passwords do not match'
                  : undefined
              }
            />
            <PrimaryButton
              label="Update password"
              onPress={handleChangePassword}
              loading={changingPassword}
            />
          </Section>

          <Section title="Delete account" accent={colors.danger}>
            <Text style={[type.body, { color: colors.tone, lineHeight: 21, marginBottom: 16 }]}>
              Deleting removes your profile, shelves, and every series you have tracked. There is no
              way to bring it back.
            </Text>
            <TouchableOpacity
              onPress={() => setShowDeleteModal(true)}
              activeOpacity={0.85}
              style={{
                borderWidth: 2,
                borderColor: colors.danger,
                paddingVertical: 13,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: type.display.fontFamily,
                  fontSize: 14,
                  fontWeight: '900',
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  color: colors.danger,
                }}
              >
                Delete my account
              </Text>
            </TouchableOpacity>
          </Section>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Delete account — password, then an explicit second confirmation */}
      <Sheet
        visible={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setConfirmingDelete(false);
        }}
        eyebrow="This cannot be undone"
        title={confirmingDelete ? 'Delete everything?' : 'Delete account'}
      >
        <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          {confirmingDelete ? (
            <>
              <Text style={[type.body, { color: colors.tone, lineHeight: 21, marginBottom: 20 }]}>
                Your account, every shelf, and all tracked chapter progress will be erased
                immediately.
              </Text>
              <View style={{ flexDirection: 'row' }}>
                <GhostButton
                  label="Keep account"
                  onPress={() => setConfirmingDelete(false)}
                  disabled={deletingAccount}
                  style={{ flex: 1, marginRight: 3 }}
                />
                <TouchableOpacity
                  onPress={handleDeleteAccount}
                  disabled={deletingAccount}
                  activeOpacity={0.85}
                  style={{
                    flex: 1,
                    backgroundColor: colors.danger,
                    paddingVertical: 15,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: deletingAccount ? 0.6 : 1,
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
                    {deletingAccount ? 'Deleting' : 'Delete'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Field
                label="Password"
                value={deletePassword}
                onChangeText={setDeletePassword}
                placeholder="Confirm with your password"
                secureTextEntry
              />
              <View style={{ flexDirection: 'row' }}>
                <GhostButton
                  label="Cancel"
                  onPress={() => setShowDeleteModal(false)}
                  style={{ flex: 1, marginRight: 3 }}
                />
                <TouchableOpacity
                  onPress={() => {
                    if (!deletePassword) {
                      showToast('Enter your password to confirm', 'error');
                      return;
                    }
                    setConfirmingDelete(true);
                  }}
                  activeOpacity={0.85}
                  style={{
                    flex: 1,
                    borderWidth: 2,
                    borderColor: colors.danger,
                    paddingVertical: 13,
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
                      color: colors.danger,
                    }}
                  >
                    Continue
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Sheet>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  );
}
