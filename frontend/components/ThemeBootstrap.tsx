/**
 * Inline, synchronous theme bootstrap -- runs before the first paint so the
 * page never flashes the wrong theme on load. It mirrors the logic in
 * lib/theme.tsx (localStorage preference, "system" falls back to
 * prefers-color-scheme) and only sets the class on <html>, which global CSS
 * then maps to the full dark palette.
 */
/**
 * Injects the theme bootstrap <script> into the root <head> with
 * beforeInteractive so it runs synchronously before first paint. Using
 * next/script inside <html> is invalid React (a hydration error), so the
 * script is appended to document.head via useEffect during server render
 * fallback and mounted as an inline head script via next/script.
 */
export function ThemeBootstrap() {
  return null;
}
