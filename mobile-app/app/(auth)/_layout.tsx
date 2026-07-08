import { Stack } from 'expo-router';
import { useTheme } from '../../constants/ThemeContext';

export default function AuthLayout() {
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
