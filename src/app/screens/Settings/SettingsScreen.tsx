import React from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../../ui/theme/ThemeContext";
import { Screen } from "../../ui/components/Screen";

export function SettingsScreen() {
  const { colors, mode, setMode, isDark } = useTheme();
  const navigation = useNavigation<any>();

  // Opções de tema (seguindo seu código antigo)
  const themeOptions = [
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
  ] as const;

  // Componente auxiliar para os botões de navegação
  function NavButton({ icon, title, subtitle, onPress }: any) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.navRow,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
          pressed && { backgroundColor: colors.iconBg },
        ]}
      >
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: colors.iconBg, borderColor: colors.border },
          ]}
        >
          <MaterialIcons name={icon} size={22} color={colors.textPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
            {title}
          </Text>
          <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        </View>
        <MaterialIcons
          name="chevron-right"
          size={24}
          color={colors.textSecondary}
        />
      </Pressable>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Configurações
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Gerencie custos, acessórios e aparência.
          </Text>
        </View>

        {/* --- SEÇÃO 1: GERENCIAMENTO (Novas Funcionalidades) --- */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Gerenciamento
          </Text>

          <View style={{ gap: 10 }}>
            <NavButton
              icon="attach-money"
              title="Parâmetros de Custo"
              subtitle="Energia, depreciação e fixos"
              onPress={() => navigation.navigate("CostParameters")}
            />
            <NavButton
              icon="extension"
              title="Acessórios e Extras"
              subtitle="Cadastrar itens complementares"
              onPress={() => navigation.navigate("AccessoriesList")}
            />
          </View>
        </View>

        {/* --- SEÇÃO 2: TEMA (Código Antigo Restaurado) --- */}
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
            {themeOptions.map((opt, index) => {
              const active = mode === opt.key;
              const isLast = index === themeOptions.length - 1;
              return (
                <View key={opt.key}>
                  <Pressable
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
                        name={opt.icon as any}
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

                  {/* Divisor entre itens, exceto no último */}
                  {!isLast && (
                    <View
                      style={[
                        styles.divider,
                        { backgroundColor: colors.border },
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </View>

          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Tema atual: {isDark ? "Escuro" : "Claro"}
          </Text>
        </View>

        {/* --- SEÇÃO 3: EM BREVE (Código Antigo Restaurado) --- */}
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
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40, gap: 24 },

  header: { marginBottom: 4 },
  title: { fontSize: 24, fontWeight: "900" },
  subtitle: { fontSize: 14, marginTop: 4 },

  section: { gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "900", textTransform: "uppercase" },

  // Estilos para o Card de Tema e Em Breve
  card: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },

  // Estilos para os Botões de Navegação (Gerenciamento)
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
  },

  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  rowTitle: { fontSize: 16, fontWeight: "700" },
  rowSub: { fontSize: 13, marginTop: 2 },

  divider: { height: 1, marginLeft: 64 }, // Recuo para alinhar com texto
  hint: { fontSize: 12, textAlign: "center", marginTop: 4 },

  // Estilo "Desabilitado" para Em Breve
  placeholderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    opacity: 0.5,
  },
});
