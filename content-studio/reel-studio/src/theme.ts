import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import '@fontsource/aref-ruqaa/700.css';

const base = {
  sans: "'IBM Plex Sans Arabic', sans-serif",
  callig: "'Aref Ruqaa', serif",
  good: '#2ee66f',
  bad: '#ff3b5c',
};

// Type 1 layout = the reference reel. Only the brand changes per account.
// Light themes reproduce the reference look (paper + grid + one brand colour + highlighter).
export const themes = {
  // Boussoula (colours from boussoula-v2/index.html)
  boussoula: {
    ...base,
    bg: '#0b0a10', grid: 'rgba(255,255,255,0.045)', surface: '#18161f', border: '#2a2634',
    text: '#f0f0f5', muted: '#8d8a99',
    accent: '#F5C542', highlight: '#F5C542', highlightText: '#0b0a10',
    interruptBg: '#F5C542', interruptText: '#0b0a10',
  },
  // TODO(brand): replace accent with Ecomanita's real colour + logo when NA7LA sends them.
  ecomanita: {
    ...base,
    bg: '#f8f7f4', grid: 'rgba(0,0,0,0.05)', surface: '#ffffff', border: '#e5e2da',
    text: '#151515', muted: '#7a776f',
    accent: '#0F8B6C', highlight: '#D9F99D', highlightText: '#151515',
    interruptBg: '#0f1c18', interruptText: '#ffffff',
  },
  // TODO(brand): replace accent with Tassyir's real colour + logo.
  tassyir: {
    ...base,
    bg: '#f7f8fb', grid: 'rgba(0,0,0,0.05)', surface: '#ffffff', border: '#e3e6ee',
    text: '#111827', muted: '#6b7280',
    accent: '#2F5BEA', highlight: '#FDE68A', highlightText: '#111827',
    interruptBg: '#0f172a', interruptText: '#ffffff',
  },
};

export type ThemeName = keyof typeof themes;

/** The active theme. Reel calls applyTheme() before rendering, so every component reads the right brand. */
export const theme = { ...themes.boussoula };
export const applyTheme = (name: ThemeName = 'boussoula') => Object.assign(theme, themes[name]);

export const FPS = 30;
export const W = 1080;
export const H = 1920;
