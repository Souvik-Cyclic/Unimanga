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
        <View key={row} style={{ flexDirection: 'row', marginBottom: gap - size }}>
          {Array.from({ length: columns }).map((__, column) => (
            <View
              key={column}
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                marginRight: gap - size,
                backgroundColor: dot,
                // Dots thin out down the block, the way a tone gradient does.
                opacity: 1 - row / (rows + 1),
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Shipped artwork shown when a series has no cover of its own. */
const COVER_PLACEHOLDER = require('../assets/cover-placeholder.png');

/**
 * Series cover. When the source gives no image, or the image fails to load
 * twice, the shipped placeholder artwork stands in so a row never shows a gap.
 */
export function Cover({
  uri,
  title,
  width,
  height,
  fallback = 'art',
}: {
  uri?: string;
  title?: string;
  /** Omit to let the cover fill the space its parent gives it. */
  width?: number;
  height: number;
  /**
   * 'art' draws the shipped placeholder cover — right for a library row, where
   * the reader needs to see that a series is there. 'panel' just darkens the
   * cell, for decorative walls where a repeated icon would read as clutter.
   */
  fallback?: 'art' | 'panel';
  /** Accepted from older call sites; the placeholder needs no colour hint. */
  accent?: string;
  fontSize?: number;
}) {
  const { colors } = useTheme();
  const [failed, setFailed] = React.useState(false);
  // Cover hosts rate-limit bursts, and a library screen requests a dozen images
  // at once. One delayed retry recovers those without a user-visible gap.
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    setFailed(false);
    setAttempt(0);
  }, [uri]);

  const handleError = () => {
    if (attempt === 0) {
      setTimeout(() => setAttempt(1), 1500);
      return;
    }
    setFailed(true);
  };

  const sizing = width === undefined ? { flex: 1 } : { width };

  if (!uri || failed) {
    if (fallback === 'panel') {
      return <View style={{ ...sizing, height, backgroundColor: colors.panel }} />;
    }
    return (
      <Image
        source={COVER_PLACEHOLDER}
        style={{ ...sizing, height, backgroundColor: colors.panel }}
        resizeMode="cover"
        accessibilityLabel={title ? `${title}, no cover art` : 'No cover art'}
      />
    );
  }

  return (
    <Image
      key={attempt}
      source={{ uri }}
      style={{ ...sizing, height, backgroundColor: colors.panelRaised }}
      resizeMode="cover"
      onError={handleError}
      accessibilityLabel={title}
    />
  );
}

/**
 * Ambient band of the reader's own covers, dimmed and faded into the page.
 * Used behind the masthead so the top of the screen carries the artwork of
 * what the reader actually collects instead of stock decoration.
 */
export function CoverWash({
  uris,
  height = 150,
  opacity = 0.22,
}: {
  uris: string[];
  height?: number;
  opacity?: number;
}) {
  const { colors, scheme } = useTheme();
  if (uris.length === 0) return null;

  // The wash fades into the page it sits on, so the stops follow the palette.
  const fade: readonly [string, string, ...string[]] =
    scheme === 'dark'
      ? ['rgba(14,14,16,0.55)', 'rgba(14,14,16,0.88)', colors.gutter]
      : ['rgba(231,227,216,0.55)', 'rgba(231,227,216,0.9)', colors.gutter];

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height, overflow: 'hidden' }}
    >
      <View style={{ flexDirection: 'row', opacity }}>
        {uris.map((uri, index) => (
          <Image
            key={`${uri}-${index}`}
            source={{ uri }}
            style={{ flex: 1, height }}
            resizeMode="cover"
          />
        ))}
      </View>
      <LinearGradient
        colors={fade}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
    </View>
  );
}

/**
 * A wall of real cover art, dimmed and faded out at the foot so type stays
 * readable over it. The auth screens use it as their backdrop; it draws from
 * the public catalogue, so it shows actual series rather than stock art.
 */
export function CoverWall({
  items,
  columns = 3,
  rows = 3,
  cellHeight = 150,
  opacity = 0.6,
  style,
}: {
  items: { uri?: string; title?: string }[];
  columns?: number;
  rows?: number;
  cellHeight?: number;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, scheme } = useTheme();

  // Only real artwork belongs on the wall; a grid of repeated placeholders
  // would look worse than no decoration at all.
  const art = items.filter((item) => !!item.uri);
  if (art.length === 0) return null;

  const fade: readonly [string, string, ...string[]] =
    scheme === 'dark'
      ? [
          'rgba(14,14,16,0.25)',
          'rgba(14,14,16,0.62)',
          'rgba(14,14,16,0.92)',
          colors.gutter,
        ]
      : [
          'rgba(231,227,216,0.3)',
          'rgba(231,227,216,0.68)',
          'rgba(231,227,216,0.94)',
          colors.gutter,
        ];

  return (
    <View pointerEvents="none" style={[{ overflow: 'hidden' }, style]}>
      <View style={{ opacity }}>
        {Array.from({ length: rows }).map((_, row) => (
          <View key={row} style={{ flexDirection: 'row' }}>
            {Array.from({ length: columns }).map((__, column) => {
              // Offset each row so the same series never sits directly above
              // itself, and use Cover so a failed image still fills its cell.
              const item = art[(row * columns + column + row * 2) % art.length];
              return (
                <Cover
                  key={`${row}-${column}`}
                  uri={item.uri}
                  title={item.title}
                  height={cellHeight}
                  fallback="panel"
                />
              );
            })}
          </View>
        ))}
      </View>
      <LinearGradient
        colors={fade}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
    </View>
  );
}

/** Horizontal run of covers — a shelf edge, used to fill wide empty areas. */
export function CoverStrip({
  items,
  onPress,
  height = 104,
  width = 72,
}: {
  items: { id: string; uri?: string; title: string; accent?: string }[];
  onPress?: (id: string) => void;
  height?: number;
  width?: number;
}) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          activeOpacity={0.85}
          disabled={!onPress}
          onPress={() => onPress?.(item.id)}
          style={{ marginRight: 3 }}
        >
          <Cover uri={item.uri} title={item.title} width={width} height={height} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

/**
 * An abstract manga page: hard-edged panels in varying sizes, one inked in the
 * accent, one filled with screentone. Drawn rather than shipped as an image, so
 * it costs nothing and stays on-palette. Stands in on the auth screens when the
 * catalogue has no cover art to show.
 */
export function PanelMontage({
  height = 200,
  style,
}: {
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const gutter = 3;

  return (
    <View pointerEvents="none" style={[{ height, flexDirection: 'row' }, style]}>
      {/* Left column: a tall establishing panel over a small one */}
      <View style={{ flex: 3, marginRight: gutter }}>
        <View style={{ flex: 2, backgroundColor: colors.panel, overflow: 'hidden' }}>
          {/* Speed lines, the way an action panel is ruled */}
          {[0, 1, 2, 3, 4, 5].map((line) => (
            <View
              key={line}
              style={{
                position: 'absolute',
                left: -20,
                top: line * 14 + 10,
                width: '150%',
                height: 2,
                backgroundColor: colors.edge,
                opacity: 1 - line * 0.14,
                transform: [{ rotate: '-14deg' }],
              }}
            />
          ))}
        </View>
        <View style={{ height: gutter }} />
        <View style={{ flex: 1, backgroundColor: colors.accent }} />
      </View>

      {/* Right column: tone panel over a pair of small beats */}
      <View style={{ flex: 2 }}>
        <View
          style={{
            flex: 3,
            backgroundColor: colors.panel,
            overflow: 'hidden',
            paddingTop: 10,
            paddingLeft: 8,
          }}
        >
          <Halftone rows={5} columns={7} size={4} gap={11} />
        </View>
        <View style={{ height: gutter }} />
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ flex: 1, backgroundColor: colors.panelRaised, marginRight: gutter }} />
          <View style={{ flex: 1, backgroundColor: colors.panel }} />
        </View>
      </View>
    </View>
  );
}

/**
 * A source site's real logo. Clearbit's public logo API is tried first -
 * it serves actual brand logos at real resolution rather than scraping
 * whatever tiny favicon.ico a site happens to link, which is what made the
 * icons here look blurry/pixelated before. Google's favicon proxy is the
 * second attempt for a domain Clearbit doesn't have (still better than
 * nothing, if lower-res), and the site's initial letter on its own colour -
 * the fallback this whole component replaced everywhere it's used - is the
 * last resort if neither image loads. Only that letter fallback keeps a
 * colour swatch behind it; a real logo is shown plainly, no colour frame
 * around it, since the logo already carries the site's own branding.
 */
export function SiteIcon({
  url,
  name,
  color,
  size,
}: {
  /** The site's own URL (e.g. Website.url) - only its hostname is used. */
  url: string;
  name: string;
  color: string;
  size: number;
}) {
  const { colors, type } = useTheme();
  const [stage, setStage] = React.useState<'clearbit' | 'google' | 'letter'>('clearbit');

  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  })();

  if (!hostname || stage === 'letter') {
    return (
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: type.display.fontFamily,
            fontSize: size * 0.45,
            fontWeight: '900',
            color: '#0E0E10',
          }}
        >
          {name.charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  }

  const uri =
    stage === 'clearbit'
      ? `https://logo.clearbit.com/${hostname}?size=${size * 3}`
      : `https://www.google.com/s2/favicons?sz=256&domain=${hostname}`;

  return (
    <View style={{ width: size, height: size, backgroundColor: colors.panelRaised, alignItems: 'center', justifyContent: 'center' }}>
      <Image
        source={{ uri }}
        style={{ width: size * 0.82, height: size * 0.82 }}
        resizeMode="contain"
        onError={() => setStage((s) => (s === 'clearbit' ? 'google' : 'letter'))}
      />
    </View>
  );
}

/** Square glass-free icon button used across headers. */
export function IconButton({
  icon,
  onPress,
  size = 38,
  accessibilityLabel,
  style,
}: {
  icon: React.ReactNode;
  onPress: () => void;
  size?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          width: size,
          height: size,
          backgroundColor: colors.panelRaised,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {icon}
    </TouchableOpacity>
  );
}
