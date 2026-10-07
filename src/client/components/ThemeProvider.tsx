import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
const storageKey = "formstash-theme";
const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void }>(null!);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<Theme | null>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === "light" || saved === "dark" ? saved : null;
    } catch { return null; }
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const theme = preference ?? (systemDark ? "dark" : "light");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    update();
    return () => media.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setPreference(next);
    try { localStorage.setItem(storageKey, next); } catch { /* Keep the toggle usable without storage. */ }
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
