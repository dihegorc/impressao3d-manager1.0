import React, { useCallback, useState, useMemo, useRef } from "react";
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
  ActivityIndicator,
  Animated,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler"; // IMPORTANTE

import { Screen } from "../../ui/components/Screen";
import { useTheme } from "../../ui/theme/ThemeContext";
import { ProductRepository } from "../../domain/repositories/ProductRepository";
import { FilamentRepository } from "../../domain/repositories/FilamentRepository";
import { applyFilamentConsumption } from "../Filaments/handlers/applyFilamentConsumption";
import type { Product } from "../../domain/models/Product";
import type { ProductsStackParamList } from "../../navigation/types";
import { AppInput } from "../../ui/components/AppInput";
import { AppButton } from "../../ui/components/AppButton";
import { uid } from "../../core/utils/uuid";

type Nav = NativeStackNavigationProp<ProductsStackParamList>;

function norm(s?: string) {
  return (s ?? "").trim().toLowerCase();
}

function toMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ProductsListScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<Product[]>([]);
  const [loadingAction, setLoadingAction] = useState(false);

  // --- MODAIS ---
  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [queueTarget, setQueueTarget] = useState<Product | null>(null);
  const [queueQty, setQueueQty] = useState("1");

  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockTarget, setStockTarget] = useState<Product | null>(null);
  const [stockQty, setStockQty] = useState("1");
  const [stockMode, setStockMode] = useState<"add" | "remove">("add");

  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const data = await ProductRepository.list();
    setItems(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // --- ESTATÍSTICAS ---
  const stats = useMemo(() => {
    let stockCount = 0;
    let queueCount = 0;
    items.forEach((p) => {
      const qty = p.quantity || 0;
      if (p.status === "ready") stockCount += qty;
      else if (p.status === "queued" || p.status === "printing")
        queueCount += qty;
    });
    return { stockCount, queueCount };
  }, [items]);

  // --- FILTRO ---
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
        if (!existing.photoUri && p.photoUri) existing.photoUri = p.photoUri;
      }
    });

    let result = Array.from(groupedMap.values());
    const q = query.trim().toLowerCase();

    if (q) {
      result = result.filter((p) => (p.name ?? "").toLowerCase().includes(q));
    }
    return result.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }, [items, query]);

  function toInt(v: string, fallback: number = 1) {
    const n = Math.trunc(Number((v ?? "").replace(",", ".").trim()));
    return Number.isFinite(n) ? n : fallback;
  }

  // --- CÁLCULOS ---
  const calculatedTotalTime = useMemo(() => {
    if (!queueTarget) return 0;
    if (queueTarget.plates && queueTarget.plates.length > 0) {
      return queueTarget.plates.reduce(
        (acc, plate) => acc + plate.estimatedMinutes,
        0,
      );
    }
    return (queueTarget as any).estimatedMinutes ?? 0;
  }, [queueTarget]);

  // --- AÇÃO: DELETAR (Swipe) ---
  const handleDeleteProduct = (item: Product, swipeableRef: Swipeable) => {
    Alert.alert(
      "Excluir Produto",
      `Deseja excluir "${item.name}" permanentemente?`,
      [
        {
          text: "Cancelar",
          style: "cancel",
          onPress: () => swipeableRef.close(), // Fecha o swipe se cancelar
        },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            await ProductRepository.remove(item.id);
            load();
          },
        },
      ],
    );
  };

  // --- AÇÕES: ESTOQUE (ADD/REMOVE) ---
  function openStockModal(item: Product, mode: "add" | "remove") {
    setStockTarget(item);
    setStockMode(mode);
    setStockQty("1");
    setStockModalOpen(true);
  }

  async function handleConfirmStockAction() {
    if (!stockTarget) return;

    const isAdd = stockMode === "add";
    const title = isAdd ? "Baixa de Material" : "Devolução de Material";
    const msg = isAdd
      ? "Esses produtos foram impressos agora? Deseja descontar os filamentos do estoque?"
      : "Deseja restabelecer o filamento ao estoque (desfazer impressão)?";

    const confirmText = isAdd ? "Sim (Consumir)" : "Sim (Restabelecer)";
    const cancelText = "Não (Apenas Ajuste)";

    Alert.alert(title, msg, [
      { text: cancelText, onPress: () => executeStockUpdate(false) },
      { text: confirmText, onPress: () => executeStockUpdate(true) },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  async function executeStockUpdate(affectFilament: boolean) {
    if (!stockTarget) return;
    setLoadingAction(true);

    try {
      const inputQty = Math.max(1, toInt(stockQty, 1));
      const currentQty = stockTarget.quantity || 0;
      const isAdd = stockMode === "add";

      // Verifica saldo se for remoção
      if (!isAdd && currentQty < inputQty) {
        throw new Error("Quantidade insuficiente em estoque para remover.");
      }

      // 1. Atualiza Filamentos (Consumo ou Restabelecimento)
      if (affectFilament) {
        const allSpools = await FilamentRepository.list();

        // Função auxiliar para processar lista de filamentos
        const processFilaments = async (
          filaments: any[],
          multiplier: number,
        ) => {
          for (const f of filaments) {
            // Se for ADD: Consome (+ grams). Se for REMOVE: Restabelece (- grams no consumo, ou seja, adiciona)
            // Aqui vamos usar lógica direta:
            // ADD -> applyFilamentConsumption (reduz do banco)
            // REMOVE -> Aumenta manualmente no banco

            const totalGrams = f.grams * multiplier;
            const compatible = allSpools.filter(
              (s) =>
                norm(s.material) === norm(f.material) &&
                norm(s.color) === norm(f.color) &&
                (!f.brand || norm(s.brand) === norm(f.brand)),
            );

            if (compatible.length > 0) {
              if (isAdd) {
                // Consumir
                await applyFilamentConsumption(compatible, totalGrams);
              } else {
                // Restabelecer (Adicionar ao primeiro compatível)
                // Como não temos histórico de qual rolo veio, devolvemos para o primeiro disponível (ou o que tem mais)
                const targetSpool = compatible[0];
                const newWeight =
                  (targetSpool.weightCurrentG || 0) + totalGrams;
                // Clampa para não ultrapassar o peso inicial se quiser ser estrito, mas por enquanto livre
                await FilamentRepository.upsert({
                  ...targetSpool,
                  weightCurrentG: newWeight,
                });
              }
            }
          }
        };

        if (stockTarget.plates && stockTarget.plates.length > 0) {
          for (const plate of stockTarget.plates) {
            const yieldQty = Math.max(1, plate.unitsOnPlate || 1);
            const runs = inputQty / yieldQty;
            await processFilaments(plate.filaments, runs);
          }
        } else if ((stockTarget as any).filaments) {
          // Legado
          await processFilaments((stockTarget as any).filaments, inputQty);
        }
      }

      // 2. Atualiza Estoque do Produto
      const newQty = isAdd ? currentQty + inputQty : currentQty - inputQty;

      await ProductRepository.upsert({
        ...stockTarget,
        quantity: newQty,
        updatedAt: new Date().toISOString(),
      });

      setStockModalOpen(false);
      setStockTarget(null);
      Alert.alert("Sucesso", "Estoque atualizado!");
      load();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setLoadingAction(false);
    }
  }

  // --- AÇÃO: FILA (COM BATCH ID) ---
  async function handleAddToQueue() {
    if (!queueTarget) return;
    const totalQty = Math.max(1, toInt(queueQty, 1));
    await executeQueueAdd(queueTarget, totalQty);
  }

  async function executeQueueAdd(product: Product, totalQty: number) {
    const all = await ProductRepository.list();
    let maxPos = all.reduce((m, p) => Math.max(m, p.queuePosition ?? 0), 0);
    const now = new Date().toISOString();

    for (let i = 0; i < totalQty; i++) {
      const currentBatchId = uid();

      if (product.plates && product.plates.length > 0) {
        for (let pIdx = 0; pIdx < product.plates.length; pIdx++) {
          const plate = product.plates[pIdx];
          maxPos++;
          await ProductRepository.upsert({
            ...product,
            id: uid(),
            batchId: currentBatchId,
            status: "queued",
            queuePosition: maxPos,
            quantity: 1,
            activePlateIndex: pIdx,
            estimatedMinutes: plate.estimatedMinutes,
            startedAt: undefined,
            finishedAt: undefined,
            createdAt: now,
            updatedAt: now,
          });
        }
      } else {
        maxPos++;
        await ProductRepository.upsert({
          ...product,
          id: uid(),
          batchId: currentBatchId,
          status: "queued",
          queuePosition: maxPos,
          quantity: 1,
          activePlateIndex: undefined,
          estimatedMinutes: (product as any).estimatedMinutes,
          startedAt: undefined,
          finishedAt: undefined,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    setQueueModalOpen(false);
    setQueueTarget(null);
    setQueueQty("1");
    load();
  }

  if (loadingAction) {
    return (
      <Screen>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 10, color: colors.textSecondary }}>
            Atualizando estoque...
          </Text>
        </View>
      </Screen>
    );
  }

  // --- COMPONENTES AUXILIARES SWIPE ---
  const renderRightActions = (
  progress: Animated.AnimatedInterpolation<number>,
  dragX: Animated.AnimatedInterpolation<number>,
  item: Product,
  ref: any
) => {
  // 1. Interpolação para o ícone crescer suavemente (Pop effect)
  const scale = dragX.interpolate({
    inputRange: [-80, -20],
    outputRange: [1, 0.5], // Começa pequeno e cresce
    extrapolate: 'clamp',
  });

  // 2. Interpolação para a opacidade (aparece aos poucos)
  const opacity = dragX.interpolate({
    inputRange: [-80, -20],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <Pressable
      onPress={() => handleDeleteProduct(item, ref)}
      // AQUI: Largura fixa de 90px
      style={{ width: 90 }} 
    >
      <View style={styles.deleteActionContainer}>
        <Animated.View style={{ transform: [{ scale }], opacity, alignItems: 'center' }}>
          <MaterialIcons name="delete-outline" size={28} color="#fff" />
          <Text style={styles.deleteActionText}>Excluir</Text>
        </Animated.View>
      </View>
    </Pressable>
  );
};

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Screen contentStyle={{ padding: 0 }}>
        <View style={[styles.page, { backgroundColor: colors.background }]}>
          {/* HEADER */}
          <View
            style={[
              styles.headerDashboard,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <View style={styles.statsRow}>
              <View
                style={[styles.statCard, { backgroundColor: colors.iconBg }]}
              >
                <Text
                  style={[styles.statLabel, { color: colors.textSecondary }]}
                >
                  Em Estoque
                </Text>
                <Text style={[styles.statValue, { color: colors.primary }]}>
                  {stats.stockCount} un
                </Text>
              </View>
              <View
                style={[styles.statCard, { backgroundColor: colors.iconBg }]}
              >
                <Text
                  style={[styles.statLabel, { color: colors.textSecondary }]}
                >
                  Na Fila
                </Text>
                <Text style={[styles.statValue, { color: "#f59e0b" }]}>
                  {stats.queueCount} jobs
                </Text>
              </View>
            </View>
          </View>

          {/* BUSCA */}
          <View
            style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}
          >
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
                placeholder="Buscar produto..."
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

          {/* LISTA SWIPEABLE */}
          <FlatList
            data={filteredItems}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 12 }}
            renderItem={({ item }) => {
              let swipeableRow: Swipeable | null = null;
              const platesCount = item.plates?.length ?? 0;
              const infoLabel =
                platesCount > 0
                  ? platesCount === 1
                    ? "1 plate"
                    : `${platesCount} plates`
                  : "Legado";

              return (
                <Swipeable
                  ref={(ref) => {
                    swipeableRow = ref;
                  }}
                  renderRightActions={(p, d) =>
                    renderRightActions(p, d, item, swipeableRow)
                  }
                  overshootRight={false} // <--- ISSO TRAVA O ARRASTO (Não deixa passar do limite)
                  friction={2} // <--- Deixa o arrasto um pouco mais "pesado/firme"
                  containerStyle={{ overflow: "visible" }}
                >
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
                    {/* Header do Card */}
                    <View style={styles.cardHeader}>
                      <View
                        style={[
                          styles.thumb,
                          { backgroundColor: colors.iconBg },
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
                            size={28}
                            color={colors.textSecondary}
                          />
                        )}
                      </View>

                      <View style={styles.cardInfo}>
                        <Text
                          style={[styles.title, { color: colors.textPrimary }]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        <Text
                          style={[styles.sub, { color: colors.textSecondary }]}
                        >
                          {item.priceBRL ? `${toMoney(item.priceBRL)} • ` : ""}
                          {infoLabel}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.badgeBig,
                          { backgroundColor: colors.iconBg },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "800",
                            color: colors.primary,
                          }}
                        >
                          {item.quantity ?? 0}
                        </Text>
                        <Text
                          style={{ fontSize: 10, color: colors.textSecondary }}
                        >
                          un
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.divider,
                        { backgroundColor: colors.border },
                      ]}
                    />

                    {/* Barra de Ações (Agora apenas 3 botões limpos) */}
                    <View style={styles.actionBar}>
                      <Pressable
                        onPress={() => {
                          setQueueTarget(item);
                          setQueueQty("1");
                          setQueueModalOpen(true);
                        }}
                        style={[
                          styles.actionButton,
                          { backgroundColor: colors.iconBg },
                        ]}
                      >
                        <MaterialIcons
                          name="playlist-add"
                          size={20}
                          color={colors.primary}
                        />
                        <Text
                          style={[styles.actionText, { color: colors.primary }]}
                        >
                          Fila
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => openStockModal(item, "remove")}
                        style={[
                          styles.actionButton,
                          { backgroundColor: "#fff7ed" },
                        ]}
                      >
                        <MaterialIcons
                          name="remove"
                          size={20}
                          color="#f97316"
                        />
                        <Text style={[styles.actionText, { color: "#f97316" }]}>
                          Baixa
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => openStockModal(item, "add")}
                        style={[
                          styles.actionButton,
                          { backgroundColor: "#f0fdf4" },
                        ]}
                      >
                        <MaterialIcons
                          name="add"
                          size={20}
                          color={colors.success}
                        />
                        <Text
                          style={[styles.actionText, { color: colors.success }]}
                        >
                          Entrada
                        </Text>
                      </Pressable>
                    </View>
                  </Pressable>
                </Swipeable>
              );
            }}
            ListEmptyComponent={
              <View style={{ paddingTop: 24, alignItems: "center" }}>
                <Text
                  style={{ color: colors.textSecondary, fontWeight: "800" }}
                >
                  {query
                    ? "Nenhum produto encontrado."
                    : "Nenhum produto cadastrado."}
                </Text>
              </View>
            }
          />

          {/* FAB */}
          <Pressable
            onPress={() => navigation.navigate("ProductForm")}
            style={[styles.fab, { backgroundColor: colors.textPrimary }]}
          >
            <MaterialIcons name="add" size={28} color={colors.background} />
          </Pressable>

          {/* MODAL: FILA */}
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
                Produzir (Fila)
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
                Tempo Total Unitário: {calculatedTotalTime.toFixed(0)} min
              </Text>

              <View style={{ gap: 12 }}>
                <AppInput
                  label="Quantidade a Produzir"
                  value={queueQty}
                  onChangeText={setQueueQty}
                  keyboardType="numeric"
                  placeholder="1"
                />
                <AppButton
                  title="Adicionar à Fila"
                  onPress={handleAddToQueue}
                />
              </View>
            </View>
          </Pressable>
        </Modal>

        {/* MODAL: ESTOQUE RÁPIDO (ADD/REMOVE) */}
        <Modal
          visible={stockModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setStockModalOpen(false)}
        >
          <Pressable
            style={[
              styles.modalBackdrop,
              { backgroundColor: "rgba(0,0,0,0.45)" },
            ]}
            onPress={() => setStockModalOpen(false)}
          >
            <View
              style={[
                styles.modalCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {stockMode === "add"
                  ? "Entrada de Estoque"
                  : "Saída de Estoque"}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontWeight: "800",
                  marginBottom: 4,
                }}
              >
                {stockTarget?.name}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                {stockMode === "add"
                  ? "Adicionar produtos que já estão prontos."
                  : "Remover produtos (vendas, perdas, etc)."}
              </Text>

              <View style={{ gap: 12 }}>
                <AppInput
                  label="Quantidade"
                  value={stockQty}
                  onChangeText={setStockQty}
                  keyboardType="numeric"
                  placeholder="1"
                />
                <AppButton
                  title={
                    stockMode === "add"
                      ? "Confirmar Entrada"
                      : "Confirmar Saída"
                  }
                  onPress={handleConfirmStockAction}
                  style={{
                    backgroundColor:
                      stockMode === "add" ? colors.success : "#f97316",
                  }}
                />
              </View>
            </View>
          </Pressable>
        </Modal>
        </View>
      </Screen>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  headerDashboard: { padding: 16, borderBottomWidth: 1, gap: 12 },
  pageTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  statsRow: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    justifyContent: "center",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
    opacity: 0.7,
  },
  statValue: { fontSize: 24, fontWeight: "900" },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: { flex: 1, fontSize: 16, fontWeight: "500" },

  // --- CARD ESTILO ---
  card: {
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: 'white',
  },
  cardHeader: {
    flexDirection: "row",
    padding: 12,
    alignItems: "center",
    gap: 12,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cardInfo: { flex: 1, justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  sub: { fontSize: 13, fontWeight: "500" },
  badgeBig: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 50,
  },

  divider: { height: 1, width: "100%", opacity: 0.5 },

  // --- BARRA DE AÇÕES (3 Botões) ---
  actionBar: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionText: { fontSize: 12, fontWeight: "700" },

  // --- SWIPE DELETE ACTION ---
 deleteActionContainer: {
    flex: 1,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    // O SEGREDO DO "CORTE": Arredondar SÓ o lado direito igual ao card
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    // Um pequeno ajuste visual para não colar na borda esquerda do card enquanto arrasta
    marginLeft: -10, 
    paddingLeft: 10,
  },
  
  deleteActionText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 10, // Texto menor para ficar mais elegante
    marginTop: 2,
  },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalBackdrop: { flex: 1, justifyContent: "center", padding: 16 },
  modalCard: { borderWidth: 1, borderRadius: 24, padding: 24, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: "800", marginBottom: 12 },
});
