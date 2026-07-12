import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../services/api.service';
import { useTheme } from '../../constants/ThemeContext';
import { Toast, useToast } from '../../components/Toast';
import { Data, Eyebrow, Field, CoverWall,
  PanelMontage, PrimaryButton } from '../../components/ui';

export default function SignupScreen() {
  const { colors, type, scheme } = useTheme();
  const router = useRouter();
  const signup = useAuthStore((state) => state.signup);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  // Cover art for the backdrop. The catalogue endpoint is public, so this
  // works before sign-in; if it is empty or unreachable the drawn panel page
  // stands in instead.
  const [covers, setCovers] = useState<{ uri?: string; title: string }[]>([]);

  useEffect(() => {
    let active = true;
    apiService.getPublicManga().then((manga) => {
      if (!active) return;
      setCovers(
        manga
          .filter((entry) => !!entry.coverImage)
          .map((entry) => ({ uri: entry.coverImage, title: entry.title }))
          .slice(0, 12)
      );
    });
    return () => {
      active = false;
    };
  }, []);

  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSignup = async () => {
    if (!username || !email || !password || !confirmPassword) {
      showToast('Fill in every field to create your account', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showToast('The two passwords do not match', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await signup(username, email, password);
      console.log('Registration successful!');
      showToast('Account created', 'success');
      setTimeout(() => {
        router.replace('/(main)/home');
      }, 500);
    } catch (error) {
      console.log('Registration error:', error);
      const errorMessage = typeof error === 'string' ? error : 'Could not create the account';
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.gutter }}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.gutter} />

      {covers.length > 0 ? (
        <CoverWall
          items={covers}
          columns={4}
          rows={2}
          cellHeight={150}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 300 }}
        />
      ) : (
        <PanelMontage height={200} style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ paddingHorizontal: 24, paddingVertical: 40 }}>
            <View style={{ marginBottom: 32 }}>
              <Eyebrow style={{ marginBottom: 10 }}>Start your library</Eyebrow>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                <Text style={[type.display, { fontSize: 44, lineHeight: 46, textTransform: 'uppercase' }]}>
                  UniManga
                </Text>
                <View
                  style={{ width: 10, height: 10, backgroundColor: colors.accent, marginLeft: 5, marginBottom: 9 }}
                />
              </View>
              <View style={{ height: 3, backgroundColor: colors.accent, width: 76, marginTop: 12 }} />
            </View>

            <Field
              label="Username"
              placeholder="How you appear in the app"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
            />

            <Field
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
            />

            <Field
              label="Password"
              placeholder="At least 6 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password-new"
              textContentType="newPassword"
              returnKeyType="next"
              right={
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={{ paddingHorizontal: 14, paddingVertical: 12 }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={19}
                    color={colors.tone}
                  />
                </TouchableOpacity>
              }
            />

            <Field
              label="Confirm password"
              placeholder="Type it again"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              autoComplete="password-new"
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={handleSignup}
              error={passwordsMismatch ? 'The two passwords do not match' : undefined}
              right={
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{ paddingHorizontal: 14, paddingVertical: 12 }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={19}
                    color={colors.tone}
                  />
                </TouchableOpacity>
              }
            />

            <PrimaryButton
              label="Create account"
              onPress={handleSignup}
              loading={isLoading}
              style={{ marginTop: 6 }}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 28 }}>
              <Data size={12}>ALREADY REGISTERED? </Data>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')} activeOpacity={0.7}>
                <Data size={12} color={colors.accent}>
                  SIGN IN
                </Data>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  );
}
