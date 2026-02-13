import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "../theme/ThemeContext"; // Importar o hook do tema

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "danger" | "ghost";
  style?: ViewStyle;
  disabled?: boolean;
  loading?: boolean;
};

export function AppButton({
  title,
  onPress,
  variant = "primary",
  style,
  disabled,
  loading,
}: Props) {
  const { colors } = useTheme(); // Pegando as cores atuais

  // Definindo estilos dinâmicos baseados no tema
  const getBackgroundColor = () => {
    if (disabled) return colors.border; // Cor desabilitada
    if (variant === "primary") return colors.primary;
    if (variant === "danger") return colors.danger;
    return "transparent"; // ghost
  };

  const getTextColor = () => {
    if (disabled) return colors.textSecondary;
    if (variant === "ghost") return colors.textPrimary;
    return colors.textOnPrimary; // Texto do botão primário/danger
  };

  const getBorderColor = () => {
    if (variant === "ghost") return colors.border;
    return "transparent";
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === "ghost" ? 1 : 0,
          opacity: pressed ? 0.8 : 1, // Feedback visual de clique
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <Text style={[styles.text, { color: getTextColor() }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  text: {
    fontSize: 16,
    fontWeight: "700",
  },
});
