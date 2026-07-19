import { Stack } from 'expo-router';
import { useTheme } from '../../constants/ThemeContext';

export default function MainLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
