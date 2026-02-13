import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../../ui/theme/ThemeContext";
import { Screen } from "../../ui/components/Screen";
import { FilamentRepository } from "../../domain/repositories/FilamentRepository";
import { Filament } from "../../domain/models/Filament";
import type { FilamentsStackParamList } from "../../navigation/types";
import { MaterialIcons } from "@expo/vector-icons";
import { ConfirmModal } from "../../ui/components/ConfirmModal";

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
  const { colors } = useTheme();

  const [items, setItems] = useState<Filament[]>([]);
  const [query, setQuery] = useState("");

  // Filtros
  const [colorFilter, setColorFilter] = useState<string>("all");
  const [colorFilterOpen, setColorFilterOpen] = useState(false);

  // Gerenciamento (Deletar Spool)
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [selectedGroupSpools, setSelectedGroupSpools] = useState<Filament[]>(
    [],
  );
  const [selectedGroupTitle, setSelectedGroupTitle] = useState("");

  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean;
    id: string | null;
  }>({
    open: false,
    id: null,
  });

  const load = useCallback(async () => {
    const data = await FilamentRepository.list();
    setItems(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // --- Lógica de Agrupamento ---
  function groupKeyOf(material: string, color: string, brand?: string) {
    const b = (brand ?? "").trim().toLowerCase();
    return `${material.trim().toLowerCase()}|${color.trim().toLowerCase()}|${b}`;
  }

  const grouped = useMemo(() => {
    return items.reduce<
      Record<
        string,
        {
          groupKey: string;
          material: string;
          color: string;
          brand?: string;
          totalG: number;
          spools: Filament[]; // Guardamos os objetos originais aqui
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
          spools: [],
        };
      }
      acc[gk].totalG += it.weightCurrentG;
      acc[gk].spools.push(it);
      return acc;
    }, {});
  }, [items]);

  const groups = useMemo(
    () =>
      Object.values(grouped).sort((a, b) =>
        a.material.localeCompare(b.material),
      ),
    [grouped],
  );

  // --- Filtros ---
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

  const colorOptions = useMemo(
    () => ["all", ...availableColors],
    [availableColors],
  );

  // --- Ações ---
  function openManageModal(group: (typeof groups)[0]) {
    setSelectedGroupSpools(group.spools);
    setSelectedGroupTitle(`${group.material} ${group.color}`);
    setManageModalOpen(true);
  }

  function handleDeleteSpool(id: string) {
    // Abre o modal customizado em vez do Alert nativo
    setConfirmDelete({ open: true, id });
  }

  async function confirmDeletion() {
    if (!confirmDelete.id) return;

    const id = confirmDelete.id;
    // ... Lógica original de exclusão ...
    await FilamentRepository.remove(id);

    const newSpools = selectedGroupSpools.filter((s) => s.id !== id);
    if (newSpools.length === 0) setManageModalOpen(false);
    else setSelectedGroupSpools(newSpools);

    load();

    // Fecha o modal
    setConfirmDelete({ open: false, id: null });
  }

  return (
    <Screen contentStyle={{ padding: 0 }}>
      <View style={[styles.page, { backgroundColor: colors.background }]}>
        {/* HEADER */}
        <View style={styles.topHeader}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Filamentos
          </Text>
        </View>

        {/* SEARCH */}
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

        {/* LIST TITLE */}
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

        {/* LISTA */}
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
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                {/* Clique principal: Consumo */}
                <Pressable
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                  onPress={() =>
                    navigation.navigate("FilamentConsumption", {
                      groupKey: item.groupKey,
                    })
                  }
                >
                  <View
                    style={[styles.thumb, { backgroundColor: colors.iconBg }]}
                  >
                    <MaterialIcons
                      name={icon.name}
                      size={22}
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
                      numberOfLines={1}
                    >
                      {item.spools.length} carretéis • {totalKg} kg
                    </Text>
                  </View>
                </Pressable>

                {/* Ações Laterais */}
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  {/* Gerenciar (Listar/Deletar) */}
                  <Pressable
                    onPress={() => openManageModal(item)}
                    style={styles.actionIcon}
                    hitSlop={10}
                  >
                    <MaterialIcons
                      name="list"
                      size={24}
                      color={colors.textSecondary}
                    />
                  </Pressable>

                  {/* Adicionar Novo */}
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
                    style={styles.actionIcon}
                    hitSlop={10}
                  >
                    <MaterialIcons
                      name="add-circle-outline"
                      size={24}
                      color={colors.primary}
                    />
                  </Pressable>
                </View>
              </View>
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

        <Pressable
          onPress={() => navigation.navigate("FilamentForm")}
          style={[styles.fab, { backgroundColor: "#2F66FF" }]}
          hitSlop={12}
        >
          <MaterialIcons name="add" size={26} color="#fff" />
        </Pressable>
      </View>

      {/* MODAL GERENCIAR CARRETÉIS (DELETAR) */}
      <Modal
        visible={manageModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setManageModalOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setManageModalOpen(false)}
        >
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                maxHeight: "60%",
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text
                style={[
                  styles.modalTitle,
                  { color: colors.textPrimary, marginBottom: 0 },
                ]}
              >
                Gerenciar Carretéis
              </Text>
              <Pressable onPress={() => setManageModalOpen(false)}>
                <MaterialIcons
                  name="close"
                  size={24}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>
            <Text
              style={{
                color: colors.textSecondary,
                marginBottom: 12,
                fontWeight: "600",
              }}
            >
              {selectedGroupTitle}
            </Text>

            <FlatList
              data={selectedGroupSpools}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ gap: 8 }}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.spoolRow,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.iconBg,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: colors.textPrimary, fontWeight: "bold" }}
                    >
                      {item.weightCurrentG}g restantes
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                      Inicial: {item.weightInitialG}g •{" "}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleDeleteSpool(item.id)}
                    style={{ padding: 8 }}
                  >
                    <MaterialIcons
                      name="delete-outline"
                      size={24}
                      color={colors.error}
                    />
                  </Pressable>
                </View>
              )}
            />
          </View>
        </Pressable>
      </Modal>

      {/* MODAL FILTRO (MANTIDO) */}
      <Modal
        visible={colorFilterOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setColorFilterOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
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
                    {opt === "all" ? "Todas" : opt}
                  </Text>
                  {active && (
                    <MaterialIcons
                      name="check"
                      size={18}
                      color={colors.textPrimary}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmModal
        visible={confirmDelete.open}
        title="Excluir Carretel"
        message="Tem certeza? Essa ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="danger" // Botão vermelho!
        onCancel={() => setConfirmDelete({ open: false, id: null })}
        onConfirm={confirmDeletion}
      />
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

  actionIcon: { padding: 4 },

  spoolRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },

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
  modalCard: { borderRadius: 18, padding: 14, borderWidth: 1 },
  modalTitle: { fontSize: 16, fontWeight: "900", marginBottom: 10 },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  modalItemText: { fontWeight: "800" },
});
