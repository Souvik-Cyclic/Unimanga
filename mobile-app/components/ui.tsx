/**
 * Shared Ink & Tone primitives.
 *
 * Every screen composes from these so the panel edges, chip shapes, and button
 * weights stay identical across the app. Each one reads the live palette from
 * `useTheme()`, so they repaint when the reader switches between light and
 * dark.
 */
import React from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ViewStyle,
  TextStyle,
  TextInputProps,
  StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../constants/ThemeContext';

/** Small uppercase marker that names the block underneath it. */
export function Eyebrow({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const { type } = useTheme();
  return <Text style={[type.eyebrow, style]}>{children}</Text>;
}

/** Monospaced run of figures — chapters, counts, percentages. */
export function Data({
  children,
  size = 12,
  color,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const { type, colors } = useTheme();
  return (
    <Text style={[type.data, { fontSize: size, color: color ?? colors.tone }, style]}>
      {children}
    </Text>
  );
}

/** A rectangle of content. Panels never round their corners. */
export function Panel({
  children,
  style,
  raised = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  raised?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: raised ? colors.panelRaised : colors.panel,
          borderLeftWidth: 2,
          borderLeftColor: colors.edge,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Pill filter. The one rounded shape in the design. */
export function Chip({
  label,
  active,
  onPress,
  count,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  count?: number;
}) {
  const { colors, type } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        marginRight: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? colors.paper : colors.panelRaised,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text
          style={{
            fontFamily: type.body.fontFamily,
            fontSize: 13,
            fontWeight: '700',
            color: active ? colors.gutter : colors.tone,
          }}
        >
          {label}
        </Text>
        {count !== undefined && (
          <Text
            style={[
              type.data,
              { fontSize: 11, marginLeft: 6, color: active ? colors.gutter : colors.toneDim },
            ]}
          >
            {count}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

/** Filled action. Square, vermilion, heavy label. */
export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, type } = useTheme();
  const inactive = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.85}
      style={[
        {
          backgroundColor: inactive ? colors.accentPressed : colors.accent,
          opacity: inactive ? 0.55 : 1,
          paddingVertical: 15,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Text
          style={{
            fontFamily: type.display.fontFamily,
            fontSize: 15,
            fontWeight: '900',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: '#FFFFFF',
          }}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

/** Quiet action that sits beside a primary one. */
export function GhostButton({
  label,
  onPress,
  disabled = false,
  tone,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, type } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        {
          backgroundColor: colors.panelRaised,
          paddingVertical: 15,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: type.display.fontFamily,
          fontSize: 15,
          fontWeight: '800',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: tone ?? colors.tone,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Labelled input. The rule under the field is the focus indicator — it turns
 * vermilion when the field is active, so focus is visible without a border box.
 */
export function Field({
  label,
  hint,
  error,
  right,
  style,
  ...inputProps
}: {
  label: string;
  hint?: string;
  error?: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
} & TextInputProps) {
  const { colors, type } = useTheme();
  const [focused, setFocused] = React.useState(false);

  return (
    <View style={[{ marginBottom: 18 }, style]}>
      <Eyebrow style={{ marginBottom: 6, color: focused ? colors.accent : colors.tone }}>
        {label}
      </Eyebrow>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.panelRaised,
          borderBottomWidth: 2,
          borderBottomColor: error ? colors.danger : focused ? colors.accent : colors.edge,
        }}
      >
        <TextInput
          placeholderTextColor={colors.toneDim}
          {...inputProps}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          style={{
            flex: 1,
            fontFamily: type.body.fontFamily,
            color: colors.paper,
            fontSize: 15,
            paddingHorizontal: 14,
            paddingVertical: 13,
          }}
        />
        {right}
      </View>
      {error ? (
        <Text style={[type.data, { fontSize: 11, color: colors.danger, marginTop: 6 }]}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={[type.data, { fontSize: 11, marginTop: 6 }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** Bottom sheet with the shared grip and title treatment. */
export function Sheet({
  visible,
  onClose,
  title,
  eyebrow,
  children,
  maxHeight,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  maxHeight?: string | number;
}) {
  const { colors, type } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View
          style={{
            backgroundColor: colors.panel,
            borderTopWidth: 3,
            borderTopColor: colors.accent,
            maxHeight: maxHeight as any,
          }}
          onStartShouldSetResponder={() => true}
        >
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            <View style={{ width: 44, height: 3, backgroundColor: colors.edge }} />
          </View>
          <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
            {eyebrow && <Eyebrow style={{ marginBottom: 6 }}>{eyebrow}</Eyebrow>}
            <Text style={[type.display, { fontSize: 22 }]} numberOfLines={2}>
              {title}
            </Text>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

/** Horizontal ink bar showing how far through a series the reader is. */
export function ProgressRule({
  percent,
  color,
  height = 3,
}: {
  percent: number;
  color?: string;
  height?: number;
}) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <View style={{ height, backgroundColor: colors.edge, overflow: 'hidden' }}>
      <View
        style={{ width: `${clamped}%`, height, backgroundColor: color ?? colors.accent }}
      />
    </View>
  );
}

/** Empty and error states: say what happened, then what to do about it. */
export function EmptyState({ headline, action }: { headline: string; action: string }) {
  const { colors, type } = useTheme();
  return (
    <View style={{ paddingVertical: 48, alignItems: 'center' }}>
      <View
        style={{
          width: 46,
          height: 46,
          borderWidth: 2,
          borderColor: colors.edge,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Text style={[type.display, { fontSize: 22, color: colors.edge }]}>?</Text>
      </View>
      <Text style={[type.title, { fontSize: 17, marginBottom: 6, textAlign: 'center' }]}>
        {headline}
      </Text>
      <Text style={[type.body, { color: colors.tone, textAlign: 'center', maxWidth: 260 }]}>
        {action}
      </Text>
    </View>
  );
}

/**
 * Halftone screentone: the dot pattern printed manga uses for shading. Fills
 * otherwise-blank areas with something drawn from the medium rather than a
 * stock illustration.
 */
export function Halftone({
  rows = 5,
  columns = 12,
  size = 4,
  gap = 12,
  color,
  style,
}: {
  rows?: number;
  columns?: number;
  size?: number;
  gap?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const dot = color ?? colors.edge;

  return (
    <View pointerEvents="none" style={style}>
      {Array.from({ length: rows }).map((_, row) => (
