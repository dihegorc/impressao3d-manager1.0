import React, { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../../ui/theme/ThemeContext";
import { SmallActionButton } from "../../ui/components/SmallActionButton";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import type { FilamentsStackParamList } from "../../navigation/types";
import { Screen } from "../../ui/components/Screen";
import { AppInput } from "../../ui/components/AppInput";
import { AppButton } from "../../ui/components/AppButton";

import { FilamentRepository } from "../../domain/repositories/FilamentRepository";
import { FilamentUsageRepository } from "../../domain/repositories/FilamentUsageRepository";
import { uid } from "../../core/utils/uuid";
import { Filament } from "../../domain/models/Filament";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

type R = RouteProp<FilamentsStackParamList, "FilamentConsumption">;
type Nav = NativeStackNavigationProp<FilamentsStackParamList>;

function toNumber(v: string): number {
  const cleaned = v.replace(",", ".").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function formatKg(g: number) {
  return `${(g / 1000).toFixed(3).replace(".", ",")} kg`;
}

function matchesGroupKey(f: Filament, groupKey: string) {
  const brand = (f.brand ?? "").trim().toLowerCase();
  const key = `${f.material.trim().toLowerCase()}|${f.color.trim().toLowerCase()}|${brand}`;
  return key === groupKey;
}

export function FilamentConsumptionScreen() {
  const route = useRoute<R>();
  const navigation = useNavigation<Nav>();
  const { groupKey } = route.params;
  const { colors } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  const [spools, setSpools] = useState<Filament[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [grams, setGrams] = useState("");
  const [note, setNote] = useState("");
  const [showSpools, setShowSpools] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const totals = useMemo(() => {
    const totalG = spools.reduce((s, f) => s + f.weightCurrentG, 0);
    return { totalG };
  }, [spools]);

  async function load() {
    const all = await FilamentRepository.list();
    const groupSpools = all
      .filter((f) => matchesGroupKey(f, groupKey))
      // FIFO: mais antigo primeiro
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    setSpools(groupSpools);

    const h = await FilamentUsageRepository.listByGroup(groupKey);
    setHistory(h);
  }

  useEffect(() => {
    load();
  }, []);

  function confirmRemoveSpool(spoolId: string, currentG: number) {
    Alert.alert(
      "Remover carretel?",
      `Isso vai remover este carretel do estoque do grupo.\nSaldo atual do carretel: ${currentG}g.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            await FilamentRepository.remove(spoolId);
            await load();
          },
        },
      ],
    );
  }

  async function applyConsumption() {
    const g = toNumber(grams);
    if (!Number.isFinite(g) || g <= 0) {
      Alert.alert("Validação", "Informe um consumo válido em gramas.");
      return;
    }

    const totalAvailable = spools.reduce((s, f) => s + f.weightCurrentG, 0);
    if (g > totalAvailable) {
      Alert.alert(
        "Sem saldo",
        `Consumo maior que o disponível. Disponível: ${totalAvailable}g.`,
      );
      return;
    }

    Alert.alert(
      "Confirmar consumo",
      `Descontar ${g}g do estoque deste grupo?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            // Consumo FIFO: percorre carretéis e vai baixando
            let remaining = g;
            const now = new Date().toISOString();

            for (const spool of spools) {
              if (remaining <= 0) break;
              const canTake = Math.min(spool.weightCurrentG, remaining);
              const newWeight = spool.weightCurrentG - canTake;

              if (newWeight <= 0) {
                // ✅ chegou a 0g: remove do estoque
                await FilamentRepository.remove(spool.id);
              } else {
                const updated: Filament = {
                  ...spool,
                  weightCurrentG: newWeight,
                  updatedAt: now,
                };
                await FilamentRepository.upsert(updated);
              }

              remaining -= canTake;
            }

            // salva histórico
            await FilamentUsageRepository.add({
              id: uid(),
              groupKey,
              gramsUsed: g,
              note: note.trim() || undefined,
              createdAt: now,
            });

            await load();

            Alert.alert(
              "Consumo registrado",
              "Deseja registrar outro consumo?",
              [
                {
                  text: "Sim",
                  onPress: () => {
                    setGrams("");
                    setNote("");
                    // fica na tela
                  },
                },
                {
                  text: "Não",
                  style: "cancel",
                  onPress: () => {
                    navigation.popToTop(); // volta para FilamentsList
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }

  return (
    <Screen contentStyle={{ paddingBottom: tabBarHeight + 16 }}>
      <Text style={[styles.h1, { color: colors.textPrimary }]}>
        Calculadora de Consumo
      </Text>

      <View
        style={[
          styles.box,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <Text style={[styles.boxLabel, { color: colors.textSecondary }]}>
          Saldo do grupo
        </Text>
        <Text style={[styles.boxValue, { color: colors.textPrimary }]}>
          {formatKg(totals.totalG)} ({totals.totalG}g)
        </Text>
        <Text style={[styles.boxSub, { color: colors.textSecondary }]}>
          Carretéis: {spools.length}
        </Text>
      </View>
      <View style={styles.consumeCard}>
        <AppInput
          label="Consumo (g)"
          value={grams}
          onChangeText={setGrams}
          keyboardType="numeric"
          placeholder="Ex: 85"
        />

        <AppInput
          label="Observação (opcional)"
          value={note}
          onChangeText={setNote}
          placeholder="Ex: Chaveiro Heitor / Suporte / etc."
        />

        <View style={{ marginTop: 6 }}>
          <AppButton title="Aplicar consumo" onPress={applyConsumption} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.h2, { color: colors.textPrimary }]}>
            Carretéis do grupo
          </Text>
          <SmallActionButton
            title={showSpools ? "Recolher" : `Expandir (${spools.length})`}
            icon={showSpools ? "expand-less" : "expand-more"}
            onPress={() => setShowSpools((v) => !v)}
          />
        </View>

        {showSpools ? (
          spools.length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>
              Nenhum carretel neste grupo.
            </Text>
          ) : (
            <FlatList
              data={spools}
              keyExtractor={(it) => it.id}
              style={{ maxHeight: 260 }} // ✅ evita cortar
              nestedScrollEnabled // ✅ ajuda no Android
              contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.spoolCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.spoolTitle, { color: colors.textPrimary }]}
                    >
                      {item.brand
                        ? `${item.material} - ${item.color} - ${item.brand}`
                        : `${item.material} - ${item.color}`}
                    </Text>
                    <Text
                      style={[styles.spoolSub, { color: colors.textSecondary }]}
                    >
                      Saldo: {item.weightCurrentG}g • Inicial:{" "}
                      {item.weightInitialG}g
                    </Text>
                  </View>
                  <SmallActionButton
                    title={"Remover"}
                    icon="delete"
                    onPress={() =>
                      confirmRemoveSpool(item.id, item.weightCurrentG)
                    }
                  />
                </View>
              )}
            />
          )
        ) : (
          <Text style={{ color: colors.textSecondary }}>
            Saldo do grupo: {formatKg(totals.totalG)} • Carretéis:{" "}
            {spools.length}
          </Text>
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.h2, { color: colors.textPrimary }]}>
            Histórico
          </Text>
          <SmallActionButton
            title={showHistory ? "Recolher" : `Expandir (${history.length})`}
            icon={showHistory ? "expand-less" : "expand-more"}
            onPress={() => setShowHistory((v) => !v)}
          />
        </View>

        {showHistory ? (
          history.length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>
              Nenhum consumo registrado.
            </Text>
          ) : (
            <FlatList
              data={history}
              keyExtractor={(it) => it.id}
              style={{ maxHeight: 260 }} // ✅ evita cortar
              nestedScrollEnabled
              contentContainerStyle={{
                paddingBottom: tabBarHeight + 16,
                gap: 10,
              }}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.histCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.histTitle, { color: colors.textPrimary }]}
                  >
                    -{item.gramsUsed}g
                  </Text>
                  <Text
                    style={[styles.histSub, { color: colors.textSecondary }]}
                  >
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                  {item.note ? (
                    <Text
                      style={[styles.histSub, { color: colors.textSecondary }]}
                    >
                      {item.note}
                    </Text>
                  ) : null}
                </View>
              )}
            />
          )
        ) : (
          <Text style={{ color: colors.textSecondary }}>
            Últimos consumos:{" "}
            {history.slice(0, 1).length ? `-${history[0].gramsUsed}g` : "—"}
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 18, fontWeight: "900" },
  h2: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: "900",
  },
  consumeCard: {
    marginTop: 8,
    gap: 12,
  },
  box: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#fafafa",
    gap: 6,
  },
  boxLabel: { color: "#666", fontSize: 12, fontWeight: "700" },
  boxValue: { fontSize: 18, fontWeight: "900" },
  boxSub: { color: "#555" },

  histCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  histTitle: { fontSize: 16, fontWeight: "900" },
  histSub: { color: "#555" },
  spoolCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#fff",
  },
  spoolTitle: { fontSize: 14, fontWeight: "900" },
  spoolSub: { color: "#555", marginTop: 4 },
  sectionHeader: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
});
