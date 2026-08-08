import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../constants/ThemeContext';
import { Palette } from '../constants/theme';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type?: ToastType;
  visible: boolean;
  onHide: () => void;
  duration?: number;
}

type ToastIcon = 'checkmark' | 'close' | 'alert' | 'information';

/** Colour and icon per outcome. The bar on the left carries the meaning. */
function toastStyles(colors: Palette): Record<ToastType, { accent: string; icon: ToastIcon }> {
  return {
    success: { accent: colors.success, icon: 'checkmark' },
    error: { accent: colors.danger, icon: 'close' },
    warning: { accent: colors.gold, icon: 'alert' },
    info: { accent: colors.accent, icon: 'information' },
  };
}

export function Toast({ message, type: toastType = 'info', visible, onHide, duration = 3000 }: ToastProps) {
  const { colors, type } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 70,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 16,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  };

  if (!visible) return null;

  const style = toastStyles(colors)[toastType];

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
        position: 'absolute',
        bottom: 36,
        left: 20,
        right: 20,
        zIndex: 9999,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.panelRaised,
          borderLeftWidth: 4,
          borderLeftColor: style.accent,
          paddingVertical: 14,
          paddingHorizontal: 14,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.4,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <Ionicons name={style.icon} size={18} color={style.accent} />
        <Text
          style={[type.body, { flex: 1, marginLeft: 10, fontSize: 14 }]}
          numberOfLines={3}
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

// Hook for managing toast state
export function useToast() {
  const [toast, setToast] = React.useState<{
    visible: boolean;
    message: string;
    type: ToastType;
  }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, visible: false }));
  };

  return {
    toast,
    showToast,
    hideToast,
  };
}
