import React from "react";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
import { useTheme } from "../ui/theme/ThemeContext";

export function ThemedNavigationContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isDark, colors } = useTheme();

  const navTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: colors.background,
          card: colors.surface, // header background
          text: colors.textPrimary, // header title
          border: colors.border,
          primary: colors.textPrimary,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: colors.background,
          card: colors.surface,
          text: colors.textPrimary,
          border: colors.border,
          primary: colors.textPrimary,
        },
      };

  return <NavigationContainer theme={navTheme}>{children}</NavigationContainer>;
}
