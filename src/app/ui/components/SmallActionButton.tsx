import React from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

type Props = {
  title: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  style?: ViewStyle;
};

export function SmallActionButton({ title, icon, onPress, style }: Props) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: pressed ? colors.surface : colors.iconBg,
          borderColor: colors.border,
        },
        style,
      ]}
      hitSlop={8}
    >
      {icon ? (
        <MaterialIcons name={icon} size={18} color={colors.textPrimary} />
      ) : null}
      <Text style={[styles.text, { color: colors.textPrimary }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  text: { fontWeight: "900" },
});
