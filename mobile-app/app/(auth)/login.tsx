import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
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
import {
  CoverWall,
  Data,
  Eyebrow,
  Field,
  Halftone,
  PanelMontage,
  PrimaryButton,
} from '../../components/ui';

export default function LoginScreen() {
  const { colors, type, scheme } = useTheme();
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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

  const handleLogin = async () => {
    if (!email || !password) {
      showToast('Enter your email and password to sign in', 'error');
      return;
    }

    setIsLoading(true);

    try {
      await login(email, password);
      console.log('Login successful!');
      showToast('Signed in', 'success');
      setTimeout(() => {
        router.replace('/(main)/home');
      }, 500);
    } catch (error) {
      console.log('Login error:', error);
      const errorMessage = typeof error === 'string' ? error : 'That email and password did not match';
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.gutter }}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.gutter} />

      {/* Real cover art from the catalogue runs behind the head of the page.
          When the catalogue cannot be reached, a drawn manga page stands in. */}
      {covers.length > 0 ? (
        <CoverWall
          items={covers}
          columns={3}
          rows={3}
          cellHeight={170}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 430 }}
        />
      ) : (
        <PanelMontage height={280} style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
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
            {/* Wordmark, set as a stacked masthead under the mark */}
            <View style={{ marginBottom: 36 }}>
              <Image
                source={require('../../assets/logo.png')}
                style={{ width: 72, height: 72, marginBottom: 18, marginLeft: -6 }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
              <Eyebrow style={{ marginBottom: 10 }}>One library, every source</Eyebrow>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                <Text style={[type.display, { fontSize: 52, lineHeight: 54, textTransform: 'uppercase' }]}>
                  UniManga
                </Text>
                <View
                  style={{ width: 11, height: 11, backgroundColor: colors.accent, marginLeft: 5, marginBottom: 11 }}
                />
              </View>
              <View style={{ height: 3, backgroundColor: colors.accent, width: 76, marginTop: 14 }} />
            </View>

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
              placeholder="Your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              enablesReturnKeyAutomatically
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

            <PrimaryButton
              label="Sign in"
              onPress={handleLogin}
              loading={isLoading}
              style={{ marginTop: 6 }}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 28 }}>
              <Data size={12}>NEW HERE? </Data>
              <TouchableOpacity onPress={() => router.push('/(auth)/signup')} activeOpacity={0.7}>
                <Data size={12} color={colors.accent}>
                  CREATE AN ACCOUNT
                </Data>
              </TouchableOpacity>
            </View>

            <Halftone style={{ marginTop: 32, alignItems: 'center' }} rows={4} columns={11} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </View>
  );
}
