import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../../ui/theme/ThemeContext";
import { Screen } from "../../ui/components/Screen";
import { FilamentRepository } from "../../domain/repositories/FilamentRepository";
import { Filament } from "../../domain/models/Filament";
import type { FilamentsStackParamList } from "../../navigation/types";
import { MaterialIcons } from "@expo/vector-icons";

type Nav = NativeStackNavigationProp<FilamentsStackParamList>;

type StockLevel = "green" | "yellow" | "red";

function stockLevel(totalG: number): StockLevel {
  if (totalG > 3000) return "green";
  if (totalG >= 1500) return "yellow";
  return "red";
}

function stockIcon(level: StockLevel) {
  switch (level) {
    case "green":
      return { name: "check-circle" as const, color: "#1e8e3e" };
    case "yellow":
      return { name: "warning" as const, color: "#f9ab00" };
    default:
      return { name: "error" as const, color: "#d93025" };
  }
}

export function FilamentsListScreen() {
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<Filament[]>([]);
  const [colorFilter, setColorFilter] = useState<string>("all");
  const [colorFilterOpen, setColorFilterOpen] = useState(false);
  const { colors } = useTheme();
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const data = await FilamentRepository.list();
    setItems(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function groupKeyOf(material: string, color: string, brand?: string) {
    const b = (brand ?? "").trim().toLowerCase();
    return `${material.trim().toLowerCase()}|${color.trim().toLowerCase()}|${b}`;
  }

  const grouped = items.reduce<
    Record<
      string,
      {
        groupKey: string;
        material: string;
        color: string;
        brand?: string;
        totalG: number;
        spools: number;
      }
    >
  >((acc, it) => {
    const gk = groupKeyOf(it.material, it.color, it.brand);
    if (!acc[gk]) {
      acc[gk] = {
        groupKey: gk,
        material: it.material,
        color: it.color,
        brand: it.brand,
        totalG: 0,
        spools: 0,
      };
    }
    acc[gk].totalG += it.weightCurrentG;
    acc[gk].spools += 1;
    return acc;
  }, {});

  const groups = Object.values(grouped).sort((a, b) =>
    a.material.localeCompare(b.material),
  );

  const groupsSearched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => {
      const t = `${g.material} ${g.color} ${g.brand ?? ""}`.toLowerCase();
      return t.includes(q);
    });
  }, [groups, query]);

  const groupsFiltered = useMemo(() => {
    return groupsSearched.filter((g) => {
      if (colorFilter === "all") return true;
      return (
        (g.color ?? "").trim().toLowerCase() ===
        colorFilter.trim().toLowerCase()
      );
    });
  }, [groupsSearched, colorFilter]);

  const availableColors = useMemo(() => {
    const colorsArr = Array.from(
      new Set(groups.map((g) => (g.color ?? "").trim()).filter(Boolean)),
    );
    colorsArr.sort((a, b) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
    );
    return colorsArr;
  }, [groups]);

  const colorOptions = useMemo(() => {
    return ["all", ...availableColors];
  }, [availableColors]);

  return (
    <Screen contentStyle={{ padding: 0 }}>
      {/* MODAL DE FILTRO DE CORES */}
      <Modal
        visible={colorFilterOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setColorFilterOpen(false)}
      >
        <Pressable
          style={[
            styles.modalBackdrop,
            { backgroundColor: "rgba(0,0,0,0.45)" },
          ]}
          onPress={() => setColorFilterOpen(false)}
        >
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Filtrar por cor
            </Text>

            {colorOptions.map((opt) => {
              const label = opt === "all" ? "Todas" : opt;
              const active = opt.toLowerCase() === colorFilter.toLowerCase();

              return (
                <Pressable
                  key={opt}
                  style={[
                    styles.modalItem,
                    { backgroundColor: active ? colors.iconBg : "transparent" },
                  ]}
                  onPress={() => {
                    setColorFilter(opt);
                    setColorFilterOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {label}
                  </Text>
                  {active ? (
                    <MaterialIcons
                      name="check"
                      size={18}
                      color={colors.textPrimary}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      <View style={[styles.page, { backgroundColor: colors.background }]}>
        {/* HEADER SUPERIOR */}
        <View style={styles.topHeader}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Filamentos
          </Text>
        </View>

        {/* BARRA DE PESQUISA */}
        <View style={styles.searchWrap}>
          <View
            style={[
              styles.searchBar,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <MaterialIcons
              name="search"
              size={20}
              color={colors.textSecondary}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Pesquisar..."
              placeholderTextColor={colors.textSecondary}
              style={[styles.searchInput, { color: colors.textPrimary }]}
            />
            <Pressable
              onPress={() => setColorFilterOpen(true)}
              style={[
                styles.iconBtn,
                { backgroundColor: colors.iconBg, borderColor: colors.border },
              ]}
              hitSlop={10}
            >
              <MaterialIcons name="tune" size={18} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        {/* CABEÇALHO DA LISTA */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Inventário
          </Text>
          <Pressable onPress={() => setColorFilter("all")} hitSlop={8}>
            <Text style={[styles.viewAll, { color: colors.textSecondary }]}>
              Ver Todos
            </Text>
          </Pressable>
        </View>

        {/* LISTA DE GRUPOS DE FILAMENTOS */}
        <FlatList
          data={groupsFiltered}
          keyExtractor={(it) => it.groupKey}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 120,
            gap: 12,
          }}
          renderItem={({ item }) => {
            const level = stockLevel(item.totalG);
            const icon = stockIcon(level);

            const title = item.brand
              ? `${item.material} - ${item.color} - ${item.brand}`
              : `${item.material} - ${item.color}`;

            const totalKg = (item.totalG / 1000).toFixed(2).replace(".", ",");

            return (
              <Pressable
                onPress={() =>
                  navigation.navigate("FilamentConsumption", {
                    groupKey: item.groupKey,
                  })
                }
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                {/* ÍCONE À ESQUERDA (Thumb) */}
                <View
                  style={[styles.thumb, { backgroundColor: colors.iconBg }]}
                >
                  <MaterialIcons
                    name={icon.name}
                    size={22}
                    color={icon.color}
                  />
                </View>

                {/* TEXTOS CENTRAIS */}
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.cardTitle, { color: colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {title}
                  </Text>
                  {/* Aqui mantemos o peso, pois fica bem na descrição */}
                  <Text
                    style={[styles.cardSub, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {item.spools} carretéis • {totalKg} kg
                  </Text>
                </View>

                {/* AÇÃO RÁPIDA (Adicionar novo carretel deste grupo) */}
                <Pressable
                  onPress={() =>
                    navigation.navigate("FilamentForm", {
                      prefill: {
                        material: item.material as any,
                        color: item.color,
                        brand: item.brand,
                      },
                    })
                  }
                  hitSlop={12}
                  style={{ paddingLeft: 8 }}
                >
                  <MaterialIcons
                    name="add-circle-outline"
                    size={28}
                    color={colors.textPrimary}
                  />
                </Pressable>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: "800" }}>
                {query?.trim()
                  ? "Nenhum item encontrado."
                  : "Nenhum filamento cadastrado ainda."}
              </Text>
            </View>
          }
        />

        {/* FAB (Botão Flutuante para criar filamento do zero) */}
        <Pressable
          onPress={() => navigation.navigate("FilamentForm")}
          style={[styles.fab, { backgroundColor: "#2F66FF" }]}
          hitSlop={12}
        >
          <MaterialIcons name="add" size={26} color="#fff" />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  topHeader: {
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: "center",
  },
  title: { fontSize: 18, fontWeight: "900" },
  searchWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: "700" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionRow: {
    marginTop: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 15, fontWeight: "900" },
  viewAll: { fontWeight: "800" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 15, fontWeight: "900" },
  cardSub: { marginTop: 4, fontWeight: "700" },
  // cardRight removido pois foi substituído pelo botão de ação
  fab: {
    position: "absolute",
    right: 18,
    bottom: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#eee",
  },
  modalTitle: { fontSize: 16, fontWeight: "900", marginBottom: 10 },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  modalItemText: { fontWeight: "800", color: "#111" },
});
