import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeContext";

type Option = { key: string; label: string };

type Props = {
  value: string;
  options: Option[];
  onChange: (key: string) => void;
};

export function Segmented({ value, options, onChange }: Props) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={({ pressed }) => [
              styles.item,
              {
                backgroundColor: active
                  ? colors.textPrimary
                  : pressed
                    ? colors.surface
                    : colors.iconBg,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.itemText,
                { color: active ? colors.background : colors.textPrimary },
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: 8,
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  item: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: { fontWeight: "900" },
});
