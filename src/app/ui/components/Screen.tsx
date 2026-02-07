import React from "react";
import { SafeAreaView, StyleSheet, View, ViewStyle } from "react-native";
import { useTheme } from "../theme/ThemeContext";

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle; // estilo do container interno
};

export function Screen({ children, style, contentStyle }: Props) {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }, style]}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: 16 },
});
