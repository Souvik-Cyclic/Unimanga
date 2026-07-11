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
