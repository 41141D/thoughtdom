"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// Persisted theme preference: "light" | "dark" | "system"
const THEME_KEY = "td_theme";

export type ThemePreference = "light" | "dark" | "system";

function getInitialTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const raw = localStorage.getItem(THEME_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

function resolveClass(pref: ThemePreference): "dark" | "" {
  if (pref === "dark") return "dark";
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "";
  }
  return "";
}

const ThemeContext = createContext<{
  theme: ThemePreference;
  setTheme: (t: ThemePreference) => void;
}>({ theme: "system", setTheme: () => {} });

// Keep the class on <html> in sync on mount and after client-side route
// transitions. The inline bootstrap script handles pre-paint; this effect
// re-applies the class when React hydration replaces the <html> node.
function useThemeClassSync(theme: ThemePreference) {
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolveClass(theme) === "dark");
  }, [theme]);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(getInitialTheme);
  useThemeClassSync(theme);

  const setTheme = useCallback((t: ThemePreference) => {
    setThemeState(t);
    localStorage.setItem(THEME_KEY, t);
    const cls = resolveClass(t);
    document.documentElement.classList.toggle("dark", cls === "dark");
  }, []);

  // Follow the system when the user chose "system".
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        mq.matches && getInitialTheme() === "system"
      );
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
