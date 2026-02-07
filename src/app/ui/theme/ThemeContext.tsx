import React, { createContext, useContext, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { darkColors, lightColors } from "./colors";

type ThemeMode = "light" | "dark" | "system";

type Theme = {
  mode: ThemeMode;
  colors: typeof lightColors;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
  isDark: boolean;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>("system");
  const isDark = mode === "dark" || (mode === "system" && system === "dark");

  const colors = useMemo(() => {
    if (mode === "system") {
      return system === "dark" ? darkColors : lightColors;
    }
    return mode === "dark" ? darkColors : lightColors;
  }, [mode, system]);

  const toggle = () => {
    setMode((prev) => {
      // se estiver em system, decide baseado no sistema atual
      const isDark =
        prev === "dark" || (prev === "system" && system === "dark");
      return isDark ? "light" : "dark";
    });
  };

  return (
    <ThemeContext.Provider value={{ mode, colors, setMode, toggle, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
