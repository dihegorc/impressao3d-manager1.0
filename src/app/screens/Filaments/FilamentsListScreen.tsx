import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
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
import type { RouteProp } from "@react-navigation/native";
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
  const { colors, isDark, toggle } = useTheme();
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
    // pega cores do grupo (que vêm do item.color original)
    const colors = Array.from(
      new Set(groups.map((g) => (g.color ?? "").trim()).filter(Boolean)),
    );

    // ordena alfabeticamente
    colors.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));

    return colors;
  }, [groups]);

  const colorOptions = useMemo(() => {
    return ["all", ...availableColors];
  }, [availableColors]);

  const availableLevels = Array.from(
    new Set(groups.map((g) => stockLevel(g.totalG))),
  ) as StockLevel[];

  const levelOrder: Record<StockLevel, number> = {
    green: 1,
    yellow: 2,
    red: 3,
  };
  availableLevels.sort((a, b) => levelOrder[a] - levelOrder[b]);

  return (
    <Screen contentStyle={{ padding: 0 }}>
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
        {/* Top header dentro da tela */}
        <View style={styles.topHeader}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Filamentos
          </Text>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
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
              placeholder="Search..."
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

        {/* Section header */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Items
          </Text>

          <Pressable onPress={() => setColorFilter("all")} hitSlop={8}>
            <Text style={[styles.viewAll, { color: colors.textSecondary }]}>
              View All
            </Text>
          </Pressable>
        </View>

        {/* List */}
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
                {/* “thumb” (ícone quadrado como na imagem) */}
                <View
                  style={[styles.thumb, { backgroundColor: colors.iconBg }]}
                >
                  <MaterialIcons
                    name={icon.name}
                    size={22}
                    color={icon.color}
                  />
                </View>

                {/* text */}
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.cardTitle, { color: colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {title}
                  </Text>
                  <Text
                    style={[styles.cardSub, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {item.spools} carretéis • {totalKg} kg
                  </Text>
                </View>

                {/* Right “price-like” (valor destacado como no design) */}
                <Text style={[styles.cardRight, { color: colors.textPrimary }]}>
                  {totalKg}kg
                </Text>
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

        {/* FAB */}
        <Pressable
          onPress={() => navigation.navigate("FilamentForm")}
          style={[
            styles.fab,
            {
              backgroundColor: "#2F66FF", // igual vibe do exemplo (azul)
            },
          ]}
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
  cardRight: { fontWeight: "900" },

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

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  empty: { marginTop: 36, gap: 12, alignItems: "flex-start" },

  emptyText: { color: "#666" },

  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#f4f4f4",
    alignItems: "center",
    justifyContent: "center",
  },
  cardActions: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
    marginTop: -2,
  },

  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  filterChipActive: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  filterText: {
    fontWeight: "800",
    color: "#111",
  },
  filterTextActive: {
    color: "#fff",
  },
  filterRow: {
    marginTop: 6,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  filterButtonText: {
    fontWeight: "900",
    color: "#111",
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
  modalTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  modalItemActive: {
    backgroundColor: "#f3f3f3",
  },
  modalItemText: {
    fontWeight: "800",
    color: "#111",
  },
  modalItemTextActive: {
    fontWeight: "900",
  },
  toolbar: {
    marginTop: 8,
    marginBottom: 2,
  },
});
