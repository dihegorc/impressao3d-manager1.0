import React from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "danger" | "ghost";
  style?: ViewStyle;
  disabled?: boolean;
};

export function AppButton({
  title,
  onPress,
  variant = "primary",
  style,
  disabled,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.base,
        variant === "primary" && styles.primary,
        variant === "danger" && styles.danger,
        variant === "ghost" && styles.ghost,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          variant === "ghost" ? styles.textGhost : styles.textSolid,
          disabled && styles.textDisabled,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  primary: { backgroundColor: "#111" },
  danger: { backgroundColor: "#b00020" },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  disabled: { opacity: 0.6 },

  text: { fontSize: 16, fontWeight: "700" },
  textSolid: { color: "#fff" },
  textGhost: { color: "#111" },
  textDisabled: { color: "#fff" },
});
