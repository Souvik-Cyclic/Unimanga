/**
 * Ink & Tone — UniManga design tokens
 *
 * The visual language borrows from printed manga: hard-edged panels sitting on
 * a black gutter, heavy condensed lettering for titles, and a monospaced face
 * for anything numeric (chapters, counts, percentages) so data reads as data.
 * One accent (vermilion, the colour of an obi band) carries every active state;
 * gold is reserved exclusively for favourites.
 *
 * Two palettes share the same token names, so a component never asks which
 * scheme is active — it reads `colors.panel` and gets the right ink for the
 * page it is printed on. Read them through `useTheme()`, not by importing a
 * palette directly.
 */
import { Platform, TextStyle } from 'react-native';

export type ColorScheme = 'dark' | 'light';

export interface Palette {
  /** Page background — the gutter between panels. */
  gutter: string;
  /** Standard panel fill. */
  panel: string;
  /** Raised panel: inactive chips, inputs, secondary buttons. */
  panelRaised: string;
  /** Panel edge, one step away from the raised fill. */
  edge: string;
  /** Primary text. */
  paper: string;
  /** Text printed on a filled accent or inverted surface. */
  inverse: string;
  /** Secondary text — screentone grey. */
  tone: string;
  /** Tertiary text and placeholders. */
  toneDim: string;
  /** The single accent. Active states, progress fill, primary actions. */
  accent: string;
  accentPressed: string;
  /** Favourites only. */
  gold: string;
  /** Destructive actions. */
  danger: string;
  /** Success, used by toasts and completed states. */
  success: string;
}

/** Ink on newsprint, printed dark. */
const dark: Palette = {
  gutter: '#0E0E10',
  panel: '#17171A',
  panelRaised: '#242429',
  edge: '#33333A',
  paper: '#F2EFE6',
  inverse: '#0E0E10',
  tone: '#8C8C96',
  toneDim: '#5C5C66',
  accent: '#FF4D2E',
  accentPressed: '#D93C21',
  gold: '#F2B53B',
  danger: '#FF5A5A',
  success: '#4ADE80',
};

/**
 * The same page printed on paper: the panel stack inverts, and the accent is
 * darkened so it still carries against a light field.
 */
const light: Palette = {
  gutter: '#E7E3D8',
  panel: '#F7F4EC',
  panelRaised: '#FFFFFF',
  edge: '#CBC5B6',
  paper: '#15151A',
  inverse: '#FFFFFF',
  tone: '#5F5F69',
  toneDim: '#8E8E98',
  accent: '#DE3C18',
  accentPressed: '#B42D0F',
  gold: '#A9750B',
  danger: '#C22B2B',
  success: '#1B7F3B',
};

export const palettes: Record<ColorScheme, Palette> = { dark, light };

/**
 * Android ships a genuine condensed grotesque and a black weight; iOS gets the
 * system face pushed to its heaviest weight with tightened tracking so both
 * platforms land on the same voice.
 */
export const fonts = {
  display: Platform.select({ android: 'sans-serif-condensed', default: undefined }),
  displayHeavy: Platform.select({ android: 'sans-serif-condensed', default: undefined }),
  body: Platform.select({ android: 'sans-serif', default: undefined }),
  mono: Platform.select({ android: 'monospace', ios: 'Menlo', default: 'monospace' }),
};

/** Panels are rectangles. The only rounded thing in the app is the pill chip. */
export const radius = {
  none: 0,
  chip: 999,
} as const;

export interface TypeScale {
  display: TextStyle;
  title: TextStyle;
  eyebrow: TextStyle;
  data: TextStyle;
  body: TextStyle;
}

/** The type scale carries colour, so it is built per palette. */
export function buildType(colors: Palette): TypeScale {
  return {
    /** Wordmark and screen titles. */
    display: {
      fontFamily: fonts.display,
      fontWeight: '900',
      letterSpacing: -0.5,
      color: colors.paper,
    },
    /** Panel and card titles. */
    title: {
      fontFamily: fonts.display,
      fontWeight: '800',
      letterSpacing: -0.2,
      color: colors.paper,
    },
    /** Small uppercase section markers. */
    eyebrow: {
      fontFamily: fonts.mono,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      color: colors.tone,
    },
    /** Chapter numbers, counts, percentages — anything the reader compares. */
    data: {
      fontFamily: fonts.mono,
      fontSize: 12,
      letterSpacing: 0.4,
      color: colors.tone,
    },
    body: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.paper,
    },
  };
}

export interface StatusMeta {
  label: string;
  color: string;
}

/** Reading-status vocabulary shared by the library list and the detail sheets. */
export function buildStatusMeta(colors: Palette): Record<string, StatusMeta> {
  return {
    reading: { label: 'Reading', color: colors.accent },
    completed: { label: 'Finished', color: colors.success },
    'on-hold': { label: 'On hold', color: colors.gold },
    dropped: { label: 'Dropped', color: colors.toneDim },
    'plan-to-read': { label: 'Queued', color: colors.tone },
  };
}
