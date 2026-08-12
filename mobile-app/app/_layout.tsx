import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { ThemeProvider, useTheme } from '../constants/ThemeContext';

export default function RootLayout() {
  const initializeAuth = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initializeAuth();
  }, []);

  return (
    <ThemeProvider>
      <ThemedStack />
    </ThemeProvider>
  );
}

/** Separate component so it can read the theme the provider above supplies. */
function ThemedStack() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.gutter },
      }}
    />
  );
}
