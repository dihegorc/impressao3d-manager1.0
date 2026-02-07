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
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { Screen } from "../../ui/components/Screen";
import { useTheme } from "../../ui/theme/ThemeContext";
import { ProductRepository } from "../../domain/repositories/ProductRepository";
import type { Product } from "../../domain/models/Product";
import type { ProductsStackParamList } from "../../navigation/types";
import { AppInput } from "../../ui/components/AppInput";
import { AppButton } from "../../ui/components/AppButton";

type Nav = NativeStackNavigationProp<ProductsStackParamList>;

export function ProductsListScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<Product[]>([]);

  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [queueTarget, setQueueTarget] = useState<Product | null>(null);
  const [queueQty, setQueueQty] = useState("1");
  const [queueEtaMin, setQueueEtaMin] = useState("0");
  const [query, setQuery] = useState("");

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;

    return items.filter((p) => {
      const name = (p.name ?? "").toLowerCase();
      const desc = (p.description ?? "").toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [items, query]);

  function toInt(v: string, fallback: number) {
    const n = Math.trunc(Number((v ?? "").replace(",", ".").trim()));
    return Number.isFinite(n) ? n : fallback;
  }

  async function addToQueue(product: Product) {
    const qty = Math.max(1, toInt(queueQty, 1));
    const eta = Math.max(0, toInt(queueEtaMin, 0));

    const all = await ProductRepository.list();
    const maxPos = all.reduce((m, p) => Math.max(m, p.queuePosition ?? 0), 0);

    const now = new Date().toISOString();

    await ProductRepository.upsert({
      ...product,
      status: "queued",
      queuePosition: maxPos + 1,
      quantity: qty,
      estimatedMinutes: eta || undefined,
      startedAt: undefined,
      finishedAt: undefined,
      updatedAt: now,
    });

    setQueueModalOpen(false);
    setQueueTarget(null);
    setQueueQty("1");
    setQueueEtaMin("0");
    await load(); // sua função de reload da lista
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
              placeholder="Buscar produto..."
              placeholderTextColor={colors.textSecondary}
              style={[styles.searchInput, { color: colors.textPrimary }]}
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery("")} hitSlop={10}>
                <MaterialIcons
                  name="close"
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            ) : null}
          </View>
        </View>
        <FlatList
          data={filteredItems}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 12 }}
          renderItem={({ item }) => {
            const reqCount = item.filaments?.length ?? 0;

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
                  <Text
                    style={[styles.sub, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    {reqCount === 0
                      ? "Sem receita de filamento ainda"
                      : `Receita: ${reqCount} item(ns) de filamento`}
                  </Text>
                </View>

                <MaterialIcons
                  name="chevron-right"
                  size={22}
                  color={colors.textSecondary}
                />

                <Pressable
                  onPress={() => {
                    setQueueTarget(item);
                    setQueueQty(String(item.quantity ?? 1));
                    setQueueEtaMin(String(item.estimatedMinutes ?? 0));
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
                    size={20}
                    color={colors.textPrimary}
                  />
                </Pressable>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={{ paddingTop: 24 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: "800" }}>
                Nenhum produto cadastrado ainda.
              </Text>
            </View>
          }
        />

        <Pressable
          onPress={() => navigation.navigate("ProductForm")}
          style={[styles.fab, { backgroundColor: colors.textPrimary }]}
          hitSlop={12}
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
                Adicionar à fila
              </Text>

              <Text
                style={{
                  color: colors.textSecondary,
                  fontWeight: "800",
                  marginBottom: 10,
                }}
              >
                {queueTarget?.name ?? ""}
              </Text>

              <View style={{ gap: 12 }}>
                <AppInput
                  label="Quantidade"
                  value={queueQty}
                  onChangeText={setQueueQty}
                  keyboardType="numeric"
                  placeholder="1"
                />

                <AppInput
                  label="Tempo estimado (min) (opcional)"
                  value={queueEtaMin}
                  onChangeText={setQueueEtaMin}
                  keyboardType="numeric"
                  placeholder="0"
                />

                <AppButton
                  title="Adicionar"
                  onPress={() => queueTarget && addToQueue(queueTarget)}
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
  queueBtn: {
    width: 42,
    height: 42,
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
  modalCard: { borderWidth: 1, borderRadius: 18, padding: 14 },
  modalTitle: { fontSize: 16, fontWeight: "900", marginBottom: 6 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 15, fontWeight: "900" },
  sub: { marginTop: 4, fontWeight: "700" },
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
});
