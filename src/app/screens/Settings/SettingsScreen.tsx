import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Screen } from "../../ui/components/Screen";
import { useTheme } from "../../ui/theme/ThemeContext";

type ThemeMode = "system" | "light" | "dark";

export function SettingsScreen() {
  const { colors, mode, setMode, isDark } = useTheme();

  const options: Array<{
    key: ThemeMode;
    title: string;
    subtitle: string;
    icon: any;
  }> = [
    {
      key: "system",
      title: "Sistema",
      subtitle: "Segue o tema do aparelho",
      icon: "settings-suggest",
    },
    {
      key: "light",
      title: "Claro",
      subtitle: "Sempre claro",
      icon: "light-mode",
    },
    {
      key: "dark",
      title: "Escuro",
      subtitle: "Sempre escuro",
      icon: "dark-mode",
    },
  ];

  return (
    <Screen>
      <View style={styles.page}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Configurações
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Personalize o app (tema e opções futuras).
        </Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Tema
          </Text>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {options.map((opt) => {
              const active = mode === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setMode(opt.key)}
                  style={[
                    styles.row,
                    active && { backgroundColor: colors.iconBg },
                  ]}
                >
                  <View
                    style={[
                      styles.iconWrap,
                      {
                        backgroundColor: colors.iconBg,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <MaterialIcons
                      name={opt.icon}
                      size={20}
                      color={colors.textPrimary}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.rowTitle, { color: colors.textPrimary }]}
                    >
                      {opt.title}
                    </Text>
                    <Text
                      style={[styles.rowSub, { color: colors.textSecondary }]}
                    >
                      {opt.subtitle}
                    </Text>
                  </View>

                  {active ? (
                    <MaterialIcons
                      name="check"
                      size={20}
                      color={colors.textPrimary}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Tema atual: {isDark ? "Escuro" : "Claro"}
          </Text>
        </View>

        {/* placeholders para futuras configs */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Em breve
          </Text>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.placeholderRow}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Unidade padrão
              </Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                g / kg
              </Text>
            </View>
            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />
            <View style={styles.placeholderRow}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Exportar dados
              </Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                CSV / Backup
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: 14 },
  title: { fontSize: 20, fontWeight: "900" },
  subtitle: { marginTop: -8, fontWeight: "700" },

  section: { gap: 10, marginTop: 6 },
  sectionTitle: { fontSize: 14, fontWeight: "900" },

  card: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  rowTitle: { fontSize: 15, fontWeight: "900" },
  rowSub: { marginTop: 2, fontWeight: "700" },

  hint: { fontWeight: "800" },

  placeholderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  divider: {
    height: 1,
    marginHorizontal: 14,
  },
});
