import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  Modal,
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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: colors.surface },
      headerTitleStyle: { color: colors.textPrimary },
      headerTintColor: colors.textPrimary,
      title: "Filamentos",
      headerRight: () => (
        <View style={{ flexDirection: "row", gap: 10 }}>
          {/* Toggle tema */}
          <Pressable
            onPress={toggle}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.surface,
            }}
            hitSlop={8}
          >
            <MaterialIcons
              name={isDark ? "light-mode" : "dark-mode"}
              size={20}
              color={colors.textPrimary}
            />
          </Pressable>

          <Pressable
            onPress={() => setColorFilterOpen(true)}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.surface,
            }}
            hitSlop={8}
          >
            <MaterialIcons
              name="filter-list"
              size={20}
              color={colors.textPrimary}
            />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("FilamentForm")}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: colors.textPrimary,
              alignItems: "center",
              justifyContent: "center",
            }}
            hitSlop={8}
          >
            <MaterialIcons name="add" size={22} color={colors.background} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, colors, isDark, toggle]);

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

  const groupsFiltered = useMemo(() => {
    return groups.filter((g) => {
      if (colorFilter === "all") return true;
      return (
        (g.color ?? "").trim().toLowerCase() ===
        colorFilter.trim().toLowerCase()
      );
    });
  }, [groups, colorFilter]);

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
    <Screen>
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
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
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
                    {
                      backgroundColor: active ? colors.iconBg : "transparent",
                    },
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

      {groupsFiltered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {items.length === 0
              ? "Nenhum filamento cadastrado ainda."
              : "Nenhum grupo corresponde ao filtro selecionado."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={groupsFiltered}
          keyExtractor={(it) => it.groupKey}
          contentContainerStyle={{ gap: 12, paddingTop: 8, paddingBottom: 20 }}
          renderItem={({ item }) => {
            const level = stockLevel(item.totalG);
            const icon = stockIcon(level);

            const title = item.brand
              ? `${item.material} - ${item.color} - ${item.brand}`
              : `${item.material} - ${item.color}`;

            const totalKg = (item.totalG / 1000).toFixed(3).replace(".", ",");

            return (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.cardLeft}>
                  <View
                    style={[
                      styles.iconWrap,
                      { backgroundColor: colors.iconBg },
                    ]}
                  >
                    <MaterialIcons
                      name={icon.name}
                      size={20}
                      color={icon.color}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.cardTitle, { color: colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {title}
                    </Text>
                    <Text
                      style={[styles.cardSub, { color: colors.textSecondary }]}
                    >
                      Total: {totalKg} kg • Carretéis: {item.spools}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  <Pressable
                    style={[
                      styles.actionBtn,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                    onPress={() =>
                      navigation.navigate("FilamentConsumption", {
                        groupKey: item.groupKey,
                      })
                    }
                  >
                    <MaterialIcons
                      name="calculate"
                      size={18}
                      color={colors.textPrimary}
                    />
                  </Pressable>

                  <Pressable
                    style={[
                      styles.actionBtn,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                    onPress={() =>
                      navigation.navigate("FilamentForm", {
                        prefill: {
                          material: item.material,
                          color: item.color,
                          brand: item.brand,
                        },
                      })
                    }
                  >
                    <MaterialIcons
                      name="add"
                      size={18}
                      color={colors.textPrimary}
                    />
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: "800" },

  empty: { marginTop: 36, gap: 12, alignItems: "flex-start" },

  emptyText: { color: "#666" },

  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#fff",

    // “shadow” cross-platform (iOS + Android)
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
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
  cardTitle: { fontSize: 15, fontWeight: "900", color: "#111" },
  cardSub: { marginTop: 4, color: "#666", fontWeight: "700" },
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
