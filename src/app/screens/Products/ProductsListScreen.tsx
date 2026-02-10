import React, { useCallback, useState, useMemo } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
  Image,
  Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { Screen } from "../../ui/components/Screen";
import { useTheme } from "../../ui/theme/ThemeContext";
import { ProductRepository } from "../../domain/repositories/ProductRepository";
import { FilamentRepository } from "../../domain/repositories/FilamentRepository";
import type { Product } from "../../domain/models/Product";
import type { ProductsStackParamList } from "../../navigation/types";
import { AppInput } from "../../ui/components/AppInput";
import { AppButton } from "../../ui/components/AppButton";
import { uid } from "../../core/utils/uuid";

type Nav = NativeStackNavigationProp<ProductsStackParamList>;

// Função para normalizar strings (comparação segura)
function norm(s?: string) {
  return (s ?? "").trim().toLowerCase();
}

export function ProductsListScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<Product[]>([]);

  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [queueTarget, setQueueTarget] = useState<Product | null>(null);
  const [queueQty, setQueueQty] = useState("1");
  const [query, setQuery] = useState("");

  // --- ESTATÍSTICAS ---
  const stats = useMemo(() => {
    let stockCount = 0;
    let queueCount = 0;

    items.forEach((p) => {
      const qty = p.quantity || 0;
      if (p.status === "ready") {
        stockCount += qty;
      } else if (p.status === "queued" || p.status === "printing") {
        queueCount += qty;
      }
    });

    return { stockCount, queueCount };
  }, [items]);

  // --- FILTRO E AGRUPAMENTO ---
  const filteredItems = useMemo(() => {
    const stockItems = items.filter(
      (p) => p.status === "ready" || p.status === undefined,
    );

    const groupedMap = new Map<string, Product>();

    stockItems.forEach((p) => {
      const normalizedName = (p.name || "Sem Nome").trim();
      if (!groupedMap.has(normalizedName)) {
        groupedMap.set(normalizedName, { ...p });
      } else {
        const existing = groupedMap.get(normalizedName)!;
        existing.quantity = (existing.quantity || 0) + (p.quantity || 0);
        if (!existing.photoUri && p.photoUri) {
          existing.photoUri = p.photoUri;
        }
      }
    });

    let result = Array.from(groupedMap.values());
    const q = query.trim().toLowerCase();

    if (q) {
      result = result.filter((p) => {
        const name = (p.name ?? "").toLowerCase();
        return name.includes(q);
      });
    }

    return result.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }, [items, query]);

  function toInt(v: string, fallback: number) {
    const n = Math.trunc(Number((v ?? "").replace(",", ".").trim()));
    return Number.isFinite(n) ? n : fallback;
  }

  // --- CÁLCULO AUTOMÁTICO DE TEMPO (UNITÁRIO PONDERADO) ---
  const calculatedTimePerUnit = useMemo(() => {
    if (!queueTarget) return 0;

    // Suporte a legado (se tiver filaments na raiz e não tiver plates)
    if (
      (!queueTarget.plates || queueTarget.plates.length === 0) &&
      (queueTarget as any).filaments
    ) {
      return (queueTarget as any).filaments.reduce(
        (acc: number, f: any) => acc + (f.plateMinutes || 0),
        0,
      );
    }

    if (!queueTarget.plates) return 0;

    // Soma o tempo de cada plate dividido pelo seu rendimento (unitsOnPlate)
    return queueTarget.plates.reduce((acc, plate) => {
      const yieldQty = Math.max(1, plate.unitsOnPlate || 1);
      const timePerUnitInThisPlate = plate.estimatedMinutes / yieldQty;
      return acc + timePerUnitInThisPlate;
    }, 0);
  }, [queueTarget]);

  // --- PREVISÃO DE TÉRMINO ---
  const forecastEndTime = useMemo(() => {
    const qty = Math.max(1, toInt(queueQty, 1));
    const totalMinutes = calculatedTimePerUnit * qty;

    if (totalMinutes <= 0) return null;

    const now = new Date();
    const end = new Date(now.getTime() + totalMinutes * 60000);
    return end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [calculatedTimePerUnit, queueQty]);

  // --- FUNÇÃO DE PRODUÇÃO ---
  async function executeAddToQueue(
    product: Product,
    totalQty: number,
    unitTime: number,
  ) {
    const all = await ProductRepository.list();
    let maxPos = all.reduce((m, p) => Math.max(m, p.queuePosition ?? 0), 0);
    const now = new Date().toISOString();

    for (let i = 0; i < totalQty; i++) {
      maxPos++;
      await ProductRepository.upsert({
        ...product,
        id: uid(),
        status: "queued",
        queuePosition: maxPos,
        quantity: 1,
        estimatedMinutes: unitTime > 0 ? unitTime : undefined,
        startedAt: undefined,
        finishedAt: undefined,
        createdAt: now,
        updatedAt: now,
      });
    }

    setQueueModalOpen(false);
    setQueueTarget(null);
    setQueueQty("1");
    await load();
  }

  // --- VALIDAÇÃO DE ESTOQUE (COM PLATES) ---
  async function handleAddToQueue() {
    if (!queueTarget) return;

    const totalQty = Math.max(1, toInt(queueQty, 1));
    const unitTime = calculatedTimePerUnit;

    const plates = queueTarget.plates || [];
    // Fallback legado
    const legacyFilaments = (queueTarget as any).filaments;

    if (plates.length > 0 || (legacyFilaments && legacyFilaments.length > 0)) {
      const allSpools = await FilamentRepository.list();

      // Mapa para acumular necessidade por (Material + Cor + Marca)
      // Chave: "PLA|Preto|Voolt3D" -> Valor: gramas totais
      const neededMap = new Map<string, number>();

      // Função auxiliar para somar no mapa
      const addToMap = (
        mat: string,
        col: string,
        brand: string | undefined,
        grams: number,
      ) => {
        const key = `${norm(mat)}|${norm(col)}|${norm(brand)}`;
        const current = neededMap.get(key) || 0;
        neededMap.set(key, current + grams);
      };

      if (plates.length > 0) {
        // Nova estrutura: Plates
        for (const plate of plates) {
          const yieldQty = Math.max(1, plate.unitsOnPlate || 1);
          // Quantas "rodadas" dessa plate precisamos para fazer o totalQty de produtos?
          // Ex: Preciso de 4 produtos. A plate faz 2 por vez. Preciso de 2 rodadas.
          // Cálculo direto por grama: (grams / yield) * totalQty

          for (const f of plate.filaments) {
            const gramsPerUnit = f.grams / yieldQty;
            const totalGramsForOrder = gramsPerUnit * totalQty;
            addToMap(f.material, f.color, f.brand, totalGramsForOrder);
          }
        }
      } else if (legacyFilaments) {
        // Estrutura antiga
        for (const f of legacyFilaments) {
          addToMap(f.material, f.color, f.brand, f.grams * totalQty);
        }
      }

      // Verifica disponibilidade
      const shortages: string[] = [];

      for (const [key, gramsNeeded] of neededMap.entries()) {
        const [mat, col, brand] = key.split("|");

        const currentStock = allSpools
          .filter(
            (s) =>
              norm(s.material) === mat &&
              norm(s.color) === col &&
              (brand === "" || norm(s.brand) === brand), // brand "" significa undefined/qualquer
          )
          .reduce((sum, s) => sum + (Number(s.weightCurrentG) || 0), 0);

        if (currentStock < gramsNeeded) {
          const missing = gramsNeeded - currentStock;
          shortages.push(`- ${mat} ${col}: Faltam ${missing.toFixed(0)}g`);
        }
      }

      if (shortages.length > 0) {
        Alert.alert(
          "Estoque Insuficiente",
          `Falta material para produzir ${totalQty} un:\n\n${shortages.join("\n")}\n\nDeseja adicionar à fila mesmo assim?`,
          [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Sim, produzir",
              style: "destructive",
              onPress: () => executeAddToQueue(queueTarget, totalQty, unitTime),
            },
          ],
        );
        return;
      }
    }

    await executeAddToQueue(queueTarget, totalQty, unitTime);
  }

  const load = useCallback(async () => {
    const data = await ProductRepository.list();
    setItems(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen contentStyle={{ padding: 0 }}>
      <View style={[styles.page, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.headerDashboard,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>
            Meus Produtos
          </Text>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.iconBg }]}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Em Estoque
              </Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {stats.stockCount} un
              </Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.iconBg }]}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Produzindo
              </Text>
              <Text style={[styles.statValue, { color: "#f59e0b" }]}>
                {stats.queueCount} un
              </Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
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
              placeholder="Buscar no catálogo..."
              placeholderTextColor={colors.textSecondary}
              style={[styles.searchInput, { color: colors.textPrimary }]}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")} hitSlop={10}>
                <MaterialIcons
                  name="close"
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            )}
          </View>
        </View>

        <FlatList
          data={filteredItems}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 12 }}
          renderItem={({ item }) => {
            // Conta total de plates ou filamentos para info visual
            const infoCount = item.plates
              ? item.plates.length
              : ((item as any).filaments?.length ?? 0);
            const infoLabel = item.plates
              ? item.plates.length === 1
                ? "1 plate"
                : `${item.plates.length} plates`
              : "Legado";

            return (
              <Pressable
                onPress={() =>
                  navigation.navigate("ProductForm", { id: item.id })
                }
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.thumb,
                    { backgroundColor: colors.iconBg, overflow: "hidden" },
                  ]}
                >
                  {item.photoUri ? (
                    <Image
                      source={{ uri: item.photoUri }}
                      style={{ width: "100%", height: "100%" }}
                    />
                  ) : (
                    <MaterialIcons
                      name="inventory-2"
                      size={22}
                      color={colors.textPrimary}
                    />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.title, { color: colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 4,
                    }}
                  >
                    <View
                      style={[styles.badge, { backgroundColor: colors.iconBg }]}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: colors.primary,
                        }}
                      >
                        {item.quantity ?? 0} em estoque
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.sub,
                      { color: colors.textSecondary, marginTop: 4 },
                    ]}
                  >
                    {item.priceBRL ? `R$ ${item.priceBRL.toFixed(2)} • ` : ""}
                    {infoLabel}
                  </Text>
                </View>

                <Pressable
                  onPress={() => {
                    setQueueTarget(item);
                    setQueueQty("1");
                    setQueueModalOpen(true);
                  }}
                  style={[
                    styles.queueBtn,
                    {
                      backgroundColor: colors.iconBg,
                      borderColor: colors.border,
                    },
                  ]}
                  hitSlop={10}
                >
                  <MaterialIcons
                    name="playlist-add"
                    size={24}
                    color={colors.textPrimary}
                  />
                </Pressable>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={{ paddingTop: 24, alignItems: "center" }}>
              <Text style={{ color: colors.textSecondary, fontWeight: "800" }}>
                {query
                  ? "Nenhum produto encontrado."
                  : "Nenhum produto cadastrado."}
              </Text>
            </View>
          }
        />

        <Pressable
          onPress={() => navigation.navigate("ProductForm")}
          style={[styles.fab, { backgroundColor: colors.textPrimary }]}
        >
          <MaterialIcons name="add" size={26} color={colors.background} />
        </Pressable>

        <Modal
          visible={queueModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setQueueModalOpen(false)}
        >
          <Pressable
            style={[
              styles.modalBackdrop,
              { backgroundColor: "rgba(0,0,0,0.45)" },
            ]}
            onPress={() => setQueueModalOpen(false)}
          >
            <View
              style={[
                styles.modalCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Produzir Item
              </Text>

              <Text
                style={{
                  color: colors.textSecondary,
                  fontWeight: "800",
                  marginBottom: 4,
                }}
              >
                {queueTarget?.name}
              </Text>

              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                Tempo estimado/un: {calculatedTimePerUnit.toFixed(0)} min
              </Text>

              <View style={{ gap: 12 }}>
                <AppInput
                  label="Quantidade (unidades)"
                  value={queueQty}
                  onChangeText={setQueueQty}
                  keyboardType="numeric"
                  placeholder="1"
                />

                {forecastEndTime && (
                  <View
                    style={[styles.infoBox, { backgroundColor: colors.iconBg }]}
                  >
                    <MaterialIcons
                      name="timer"
                      size={16}
                      color={colors.primary}
                    />
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: 12,
                        fontWeight: "bold",
                      }}
                    >
                      Se iniciar agora, termina tudo às {forecastEndTime}
                    </Text>
                  </View>
                )}

                <AppButton
                  title="Confirmar Produção"
                  onPress={handleAddToQueue}
                />
              </View>
            </View>
          </Pressable>
        </Modal>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  headerDashboard: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  pageTitle: { fontSize: 22, fontWeight: "900" },
  statsRow: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: { fontSize: 12, fontWeight: "700", marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: "900" },
  queueBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
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
  modalBackdrop: { flex: 1, justifyContent: "center", padding: 16 },
  modalCard: { borderWidth: 1, borderRadius: 18, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: "900", marginBottom: 6 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  thumb: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "900" },
  sub: { fontSize: 12, fontWeight: "600" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
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
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginTop: 4,
  },
});
