/**
 * Theme plumbing: holds the reader's light/dark choice, persists it, and hands
 * components the palette, the type scale, and the status vocabulary built from
 * it. Screens call `useTheme()` instead of importing a palette, so a change of
 * scheme repaints the whole app.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildStatusMeta,
  buildType,
  ColorScheme,
  Palette,
  palettes,
  StatusMeta,
  TypeScale,
} from './theme';

/** What the reader picked. 'system' follows the phone's own setting. */
export type ThemePreference = ColorScheme | 'system';

const STORAGE_KEY = 'themePreference';

interface ThemeValue {
  colors: Palette;
  type: TypeScale;
  statusMeta: Record<string, StatusMeta>;
  /** The scheme actually being painted. */
  scheme: ColorScheme;
  /** What the reader chose, which may be 'system'. */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** Flip between light and dark, leaving 'system' behind. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('dark');

  // Restore the saved choice on launch. Until it arrives the app paints dark,
  // which is what an unconfigured reader gets anyway.
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (!active) return;
      if (saved === 'dark' || saved === 'light' || saved === 'system') {
        setPreferenceState(saved);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch((error) =>
      console.log('[theme] Could not save the theme preference:', error)
    );
  }, []);

  const scheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;

  const toggle = useCallback(() => {
    setPreference(scheme === 'dark' ? 'light' : 'dark');
  }, [scheme, setPreference]);

  const value = useMemo<ThemeValue>(() => {
    const colors = palettes[scheme];
    return {
      colors,
      type: buildType(colors),
      statusMeta: buildStatusMeta(colors),
      scheme,
      preference,
      setPreference,
      toggle,
    };
  }, [scheme, preference, setPreference, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used inside a ThemeProvider');
  }
  return value;
}
