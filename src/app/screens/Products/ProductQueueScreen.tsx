import React, { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";

import { Screen } from "../../ui/components/Screen";
import { useTheme } from "../../ui/theme/ThemeContext";
import { ProductRepository } from "../../domain/repositories/ProductRepository";
import { FilamentRepository } from "../../domain/repositories/FilamentRepository";
import { applyFilamentConsumption } from "../Filaments/handlers/applyFilamentConsumption";
import type { Product } from "../../domain/models/Product";

async function reindexQueue(currentItems: Product[]) {
  const sorted = [...currentItems].sort(
    (a, b) => (a.queuePosition ?? 999) - (b.queuePosition ?? 999),
  );
  const updates = sorted.map((p, index) => {
    const newPos = index + 1;
    if (p.queuePosition !== newPos) return { ...p, queuePosition: newPos };
    return null;
  });
  for (const up of updates) if (up) await ProductRepository.upsert(up);
}

export function ProductQueueScreen() {
  const { colors } = useTheme();
  const [queue, setQueue] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const all = await ProductRepository.list();
    const inQueue = all.filter(
      (p) => p.status === "queued" || p.status === "printing",
    );
    inQueue.sort((a, b) => (a.queuePosition ?? 999) - (b.queuePosition ?? 999));
    setQueue(inQueue);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // --- Helper: Calcula tempo total seguro ---
  function getTotalTime(item: Product): number {
    // 1. Tenta usar o snapshot gravado na fila
    if (item.estimatedMinutes && item.estimatedMinutes > 0)
      return item.estimatedMinutes;

    // 2. Se não tiver, calcula das plates (Fallback)
    if (item.plates && item.plates.length > 0) {
      return item.plates.reduce((acc, plate) => {
        const yieldQty = Math.max(1, plate.unitsOnPlate || 1);
        return acc + plate.estimatedMinutes / yieldQty;
      }, 0);
    }

    // 3. Fallback legado
    return (item as any).estimatedMinutes ?? 0;
  }

  function getFinishTime(item: Product) {
    if (!item.startedAt) return null;
    const duration = getTotalTime(item);
    if (duration <= 0) return null;

    const start = new Date(item.startedAt).getTime();
    const end = start + duration * 60000;
    return new Date(end).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // --- AÇÕES ---

  async function moveUp(index: number) {
    if (index === 0) return;
    const items = [...queue];
    const itemA = items[index];
    const itemB = items[index - 1];
    const posA = itemA.queuePosition ?? index + 1;
    const posB = itemB.queuePosition ?? index;
    await ProductRepository.upsert({ ...itemA, queuePosition: posB });
    await ProductRepository.upsert({ ...itemB, queuePosition: posA });
    load();
  }

  async function moveDown(index: number) {
    if (index === queue.length - 1) return;
    const items = [...queue];
    const itemA = items[index];
    const itemB = items[index + 1];
    const posA = itemA.queuePosition ?? index + 1;
    const posB = itemB.queuePosition ?? index + 2;
    await ProductRepository.upsert({ ...itemA, queuePosition: posB });
    await ProductRepository.upsert({ ...itemB, queuePosition: posA });
    load();
  }

  async function startPrint(item: Product) {
    const now = new Date().toISOString();
    await ProductRepository.upsert({
      ...item,
      status: "printing",
      startedAt: now,
    });
    load();
  }

  async function removeFromQueue(item: Product) {
    Alert.alert("Remover", "Deseja cancelar este item?", [
      { text: "Não" },
      {
        text: "Sim",
        style: "destructive",
        onPress: async () => {
          await ProductRepository.remove(item.id);
          await reindexQueue(queue.filter((p) => p.id !== item.id));
          load();
        },
      },
    ]);
  }

  async function finishPrint(item: Product) {
    Alert.alert(
      "Finalizar Job",
      "Confirmar finalização? O estoque de filamento será atualizado.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            setLoading(true);
            try {
              const allSpools = await FilamentRepository.list();

              // Consumo via Plates
              if (item.plates && item.plates.length > 0) {
                for (const plate of item.plates) {
                  const yieldQty = Math.max(1, plate.unitsOnPlate || 1);
                  for (const f of plate.filaments) {
                    const gramsToConsume = f.grams / yieldQty;
                    const compatible = allSpools.filter(
                      (s) =>
                        s.material === f.material &&
                        s.color === f.color &&
                        (!f.brand || s.brand === f.brand),
                    );
                    if (compatible.length > 0) {
                      await applyFilamentConsumption(
                        compatible,
                        gramsToConsume,
                      );
                    }
                  }
                }
              }

              await ProductRepository.upsert({
                ...item,
                status: "ready",
                finishedAt: new Date().toISOString(),
                queuePosition: undefined,
              });

              const remaining = queue.filter((p) => p.id !== item.id);
              await reindexQueue(remaining);
              load();
            } catch (e: any) {
              Alert.alert("Erro", e.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  }

  if (loading)
    return (
      <Screen>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );

  return (
    <Screen contentStyle={{ padding: 0 }}>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Fila de Impressão
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <MaterialIcons
            name="playlist-play"
            size={20}
            color={colors.primary}
          />
          <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>
            {queue.length} {queue.length === 1 ? "item" : "itens"} na fila
          </Text>
        </View>
      </View>

      <FlatList
        data={queue}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 14 }}
        renderItem={({ item, index }) => {
          const isPrinting = item.status === "printing";
          const isFirst = index === 0;
          const isLast = index === queue.length - 1;

          // Usa a função segura para pegar o tempo
          const totalMinutes = getTotalTime(item);
          const finishTime = isPrinting ? getFinishTime(item) : null;

          return (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isPrinting ? colors.iconBg : colors.surface,
                  borderColor: isPrinting ? colors.primary : colors.border,
                  borderWidth: isPrinting ? 2 : 1,
                },
              ]}
            >
              <View style={styles.controlCol}>
                {!isPrinting && (
                  <Pressable
                    onPress={() => moveUp(index)}
                    disabled={isFirst}
                    style={{ opacity: isFirst ? 0.3 : 1, padding: 8 }}
                  >
                    <MaterialIcons
                      name="keyboard-arrow-up"
                      size={28}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                )}
                <View
                  style={[
                    styles.posBadge,
                    {
                      backgroundColor: isPrinting
                        ? colors.primary
                        : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.posText,
                      { color: isPrinting ? "#fff" : colors.textPrimary },
                    ]}
                  >
                    {isPrinting ? (
                      <MaterialIcons name="print" size={14} color="#fff" />
                    ) : (
                      `#${index + 1}`
                    )}
                  </Text>
                </View>
                {!isPrinting && (
                  <Pressable
                    onPress={() => moveDown(index)}
                    disabled={isLast}
                    style={{ opacity: isLast ? 0.3 : 1, padding: 8 }}
                  >
                    <MaterialIcons
                      name="keyboard-arrow-down"
                      size={28}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                )}
              </View>

              <View
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 14,
                  justifyContent: "center",
                }}
              >
                <Text
                  style={[styles.cardTitle, { color: colors.textPrimary }]}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>

                {isPrinting && finishTime ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      marginBottom: 4,
                    }}
                  >
                    <MaterialIcons
                      name="timer"
                      size={14}
                      color={colors.primary}
                    />
                    <Text
                      style={{
                        color: colors.primary,
                        fontWeight: "bold",
                        fontSize: 13,
                      }}
                    >
                      Termina às {finishTime}
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={[styles.cardSub, { color: colors.textSecondary }]}
                  >
                    Tempo est.: {totalMinutes.toFixed(0)} min
                  </Text>
                )}

                <View style={{ flexDirection: "row", marginTop: 8 }}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: isPrinting ? "#e6f4ea" : "#fce8e6" },
                    ]}
                  >
                    <Text
                      style={{
                        color: isPrinting ? "#137333" : "#c5221f",
                        fontSize: 11,
                        fontWeight: "900",
                      }}
                    >
                      {isPrinting ? "IMPRIMINDO AGORA" : "NA FILA"}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.actionCol}>
                {isPrinting ? (
                  <Pressable
                    onPress={() => finishPrint(item)}
                    style={[
                      styles.actionBtn,
                      { backgroundColor: colors.success },
                    ]}
                  >
                    <MaterialIcons name="check" size={26} color="#fff" />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => startPrint(item)}
                    style={[
                      styles.actionBtn,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <MaterialIcons name="play-arrow" size={26} color="#fff" />
                  </Pressable>
                )}
                <Pressable
                  onPress={() => removeFromQueue(item)}
                  style={[styles.miniBtn, { marginTop: 16 }]}
                  hitSlop={10}
                >
                  <MaterialIcons
                    name="close"
                    size={22}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={{ paddingTop: 60, alignItems: "center", opacity: 0.5 }}>
            <MaterialIcons
              name="playlist-add-check"
              size={64}
              color={colors.textSecondary}
            />
            <Text
              style={{
                color: colors.textSecondary,
                marginTop: 16,
                fontWeight: "600",
              }}
            >
              A fila está vazia.
            </Text>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 4,
  },
  title: { fontSize: 24, fontWeight: "900" },
  card: {
    flexDirection: "row",
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    minHeight: 110,
    elevation: 1,
  },
  controlCol: {
    width: 56,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.02)",
    borderRightWidth: 1,
    borderRightColor: "rgba(0,0,0,0.05)",
  },
  posBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  posText: { fontSize: 13, fontWeight: "900" },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 6,
    lineHeight: 22,
  },
  cardSub: { fontSize: 13, lineHeight: 18 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  actionCol: {
    width: 70,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: "rgba(0,0,0,0.05)",
    backgroundColor: "rgba(0,0,0,0.01)",
  },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  miniBtn: { padding: 8 },
});
