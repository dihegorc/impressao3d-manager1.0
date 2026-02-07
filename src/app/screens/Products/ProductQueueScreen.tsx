import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";

import { Screen } from "../../ui/components/Screen";
import { useTheme } from "../../ui/theme/ThemeContext";

import { ProductRepository } from "../../domain/repositories/ProductRepository";
import { FilamentRepository } from "../../domain/repositories/FilamentRepository";
import { FilamentUsageRepository } from "../../domain/repositories/FilamentUsageRepository";
import { uid } from "../../core/utils/uuid";

import type {
  Product,
  ProductStatus,
  ProductFilament,
} from "../../domain/models/Product";
import type { Filament } from "../../domain/models/Filament";

const STATUS_LABEL: Record<ProductStatus, string> = {
  queued: "Na fila",
  printing: "Imprimindo",
  finishing: "Retoques",
  ready: "Pronto / Estoque",
};

const NEXT_STATUS: Record<ProductStatus, ProductStatus | null> = {
  queued: "printing",
  printing: "finishing",
  finishing: "ready",
  ready: null,
};

function groupKeyOf(material: string, color: string, brand?: string) {
  const b = (brand ?? "").trim().toLowerCase();
  return `${material.trim().toLowerCase()}|${color.trim().toLowerCase()}|${b}`;
}

function matchesGroupKey(f: Filament, groupKey: string) {
  const brand = (f.brand ?? "").trim().toLowerCase();
  const key = `${f.material.trim().toLowerCase()}|${f.color.trim().toLowerCase()}|${brand}`;
  return key === groupKey;
}

function sumRequirements(reqs: ProductFilament[], qty: number) {
  // soma por grupo (se tiver repetidos)
  const acc = new Map<
    string,
    { groupKey: string; grams: number; label: string }
  >();
  for (const r of reqs) {
    const gk = groupKeyOf(r.material, r.color, r.brand);
    const need = (r.grams ?? 0) * qty;
    const label = r.brand
      ? `${r.material} - ${r.color} - ${r.brand}`
      : `${r.material} - ${r.color}`;
    const prev = acc.get(gk);
    if (prev) {
      prev.grams += need;
    } else {
      acc.set(gk, { groupKey: gk, grams: need, label });
    }
  }
  return Array.from(acc.values());
}

export function ProductQueueScreen() {
  const { colors } = useTheme();
  const [items, setItems] = useState<Product[]>([]);
  const [filter, setFilter] = useState<ProductStatus>("queued");

  const load = useCallback(async () => {
    const all = await ProductRepository.list();
    setItems(all);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    return items
      .filter((p) => p.status === filter)
      .sort(
        (a, b) => (a.queuePosition ?? 999999) - (b.queuePosition ?? 999999),
      );
  }, [items, filter]);

  async function applyConsumptionAndFinish(product: Product) {
    const qty = product.quantity ?? 1;
    const reqs = product.filaments ?? [];
    if (reqs.length === 0) {
      // sem receita → finaliza sem consumir
      const now = new Date().toISOString();
      await ProductRepository.upsert({
        ...product,
        status: "ready",
        finishedAt: now,
        updatedAt: now,
      });
      await load();
      return;
    }

    const needByGroup = sumRequirements(reqs, qty);

    const allSpools = await FilamentRepository.list();

    // valida saldo
    const missing: string[] = [];
    for (const req of needByGroup) {
      const spools = allSpools
        .filter((f) => matchesGroupKey(f, req.groupKey))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)); // FIFO

      const available = spools.reduce((s, f) => s + f.weightCurrentG, 0);
      if (req.grams > available) {
        missing.push(
          `${req.label}: faltam ${Math.ceil(req.grams - available)}g`,
        );
      }
    }

    if (missing.length) {
      Alert.alert("Sem filamento suficiente", missing.join("\n"));
      return;
    }

    // confirma
    Alert.alert(
      "Finalizar e aplicar consumo?",
      `Produto: ${product.name}\nQuantidade: ${qty}\n\nO estoque de filamento será descontado automaticamente.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Finalizar",
          style: "destructive",
          onPress: async () => {
            const now = new Date().toISOString();

            // aplica consumo FIFO por grupo
            for (const req of needByGroup) {
              let remaining = req.grams;

              const spools = (await FilamentRepository.list())
                .filter((f) => matchesGroupKey(f, req.groupKey))
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt)); // FIFO

              for (const spool of spools) {
                if (remaining <= 0) break;

                const canTake = Math.min(spool.weightCurrentG, remaining);
                const newWeight = spool.weightCurrentG - canTake;

                if (newWeight <= 0) {
                  await FilamentRepository.remove(spool.id);
                } else {
                  await FilamentRepository.upsert({
                    ...spool,
                    weightCurrentG: newWeight,
                    updatedAt: now,
                  });
                }

                remaining -= canTake;
              }

              // registra histórico (uma linha por grupo consumido)
              await FilamentUsageRepository.add({
                id: uid(),
                groupKey: req.groupKey,
                gramsUsed: req.grams,
                note: `Produto: ${product.name} x${qty}`,
                createdAt: now,
              } as any);
            }

            // finaliza produto
            await ProductRepository.upsert({
              ...product,
              status: "ready",
              finishedAt: now,
              updatedAt: now,
            });

            await load();
            Alert.alert(
              "Finalizado",
              "Consumo aplicado e produto marcado como pronto.",
            );
          },
        },
      ],
    );
  }

  async function moveNext(p: Product) {
    const next = NEXT_STATUS[p.status];
    if (!next) return;

    const now = new Date().toISOString();

    if (next === "ready") {
      await applyConsumptionAndFinish(p);
      return;
    }

    await ProductRepository.upsert({
      ...p,
      status: next,
      startedAt: next === "printing" ? now : p.startedAt,
      updatedAt: now,
    });
    await load();
  }

  return (
    <Screen contentStyle={{ padding: 0 }}>
      <View style={[styles.page, { backgroundColor: colors.background }]}>
        <View style={styles.tabs}>
          {(
            ["queued", "printing", "finishing", "ready"] as ProductStatus[]
          ).map((s) => {
            const active = s === filter;
            return (
              <Pressable
                key={s}
                onPress={() => setFilter(s)}
                style={[
                  styles.tab,
                  {
                    backgroundColor: active
                      ? colors.textPrimary
                      : colors.iconBg,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? colors.background : colors.textPrimary,
                    fontWeight: "900",
                    fontSize: 12,
                  }}
                >
                  {STATUS_LABEL[s]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}
          renderItem={({ item }) => (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.title, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontWeight: "800",
                    marginTop: 4,
                  }}
                >
                  {STATUS_LABEL[item.status]} • pos: {item.queuePosition ?? "-"}{" "}
                  • qtd: {item.quantity ?? 1}
                </Text>
              </View>

              {NEXT_STATUS[item.status] ? (
                <Pressable
                  onPress={() => moveNext(item)}
                  style={[
                    styles.action,
                    { backgroundColor: colors.textPrimary },
                  ]}
                  hitSlop={10}
                >
                  <MaterialIcons
                    name="arrow-forward"
                    size={20}
                    color={colors.background}
                  />
                </Pressable>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            <View style={{ paddingTop: 18 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: "800" }}>
                Nada aqui por enquanto.
              </Text>
            </View>
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  tabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: { fontSize: 15, fontWeight: "900" },
  action: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
