import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../../ui/theme/ThemeContext";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { applyFilamentConsumption } from "./handlers/applyFilamentConsumption";

import type { FilamentsStackParamList } from "../../navigation/types";
import { Screen } from "../../ui/components/Screen";
import { AppInput } from "../../ui/components/AppInput";
import { AppButton } from "../../ui/components/AppButton";

import { FilamentRepository } from "../../domain/repositories/FilamentRepository";
import { FilamentUsageRepository } from "../../domain/repositories/FilamentUsageRepository";
import { Filament } from "../../domain/models/Filament";
import { FilamentUsage } from "../../domain/models/FilamentUsage";

type R = RouteProp<FilamentsStackParamList, "FilamentConsumption">;
type Nav = NativeStackNavigationProp<FilamentsStackParamList>;

function toNumber(v: string): number {
  const cleaned = v.replace(",", ".").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function formatKg(g: number) {
  return (g / 1000).toFixed(3).replace(".", ",");
}

export function FilamentConsumptionScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const { groupKey } = route.params;
  const { colors } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [history, setHistory] = useState<FilamentUsage[]>([]);
  const [grams, setGrams] = useState("");
  const [processing, setProcessing] = useState(false);

  // Carrega dados
  useEffect(() => {
    load();
  }, [groupKey]);

  async function load() {
    // 1. Busca filamentos do grupo
    const all = await FilamentRepository.list();

    const filtered = all.filter((f) => {
      const b = (f.brand ?? "").trim().toLowerCase();
      const gk = `${f.material.trim().toLowerCase()}|${f.color.trim().toLowerCase()}|${b}`;
      return gk === groupKey;
    });

    // Ordena para consumir primeiro de quem tem mais (ou outra lógica)
    filtered.sort((a, b) => b.weightCurrentG - a.weightCurrentG);
    setFilaments(filtered);

    // 2. CORREÇÃO: Busca histórico direto pelo groupKey
    try {
      const usages = await FilamentUsageRepository.listByGroup(groupKey);
      // Ordena por data (mais recente primeiro)
      usages.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      setHistory(usages);
    } catch (e) {
      console.error("Erro ao carregar histórico:", e);
    }
  }

  // Estatísticas do grupo
  const stats = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const f of filaments) {
      total += f.weightCurrentG;
      count++;
    }
    return { total, count, material: filaments[0]?.material ?? "?" };
  }, [filaments]);

  async function onConfirm() {
    if (processing) return;
    const g = toNumber(grams);
    if (!Number.isFinite(g) || g <= 0) {
      Alert.alert("Inválido", "Informe a quantidade em gramas.");
      return;
    }

    if (g > stats.total) {
      Alert.alert(
        "Saldo insuficiente",
        `Você tem ${stats.total}g neste grupo, mas tentou consumir ${g}g.`,
      );
      return;
    }

    setProcessing(true);
    try {
      // Algoritmo de baixa no estoque
      await applyFilamentConsumption(filaments, g);
      setGrams("");
      await load(); // Recarrega os dados
      Alert.alert("Sucesso", "Consumo registrado!");
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 16,
            paddingBottom: tabBarHeight + 20,
            gap: 12,
          }}
          ListHeaderComponent={
            <View style={{ gap: 12 }}>
              <Text style={[styles.h1, { color: colors.textPrimary }]}>
                Registrar Consumo
              </Text>

              <View style={styles.box}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={styles.boxLabel}>ESTOQUE TOTAL (GRUPO)</Text>
                  <Text style={[styles.boxLabel, { color: colors.primary }]}>
                    {stats.material}
                  </Text>
                </View>
                <Text style={[styles.boxValue, { color: colors.textPrimary }]}>
                  {formatKg(stats.total)} kg
                </Text>
                <Text style={styles.boxSub}>
                  {stats.count} carretéis disponíveis
                </Text>
              </View>

              <View style={styles.consumeCard}>
                <AppInput
                  label="Quantidade consumida (g)"
                  value={grams}
                  onChangeText={setGrams}
                  keyboardType="numeric"
                  placeholder="Ex: 150"
                />

                <AppButton
                  title={processing ? "Salvando..." : "Confirmar Consumo"}
                  onPress={onConfirm}
                  disabled={processing}
                />
              </View>

              <View
                style={{
                  height: 1,
                  backgroundColor: colors.border,
                  marginVertical: 8,
                }}
              />

              <Text style={[styles.h2, { color: colors.textPrimary }]}>
                Histórico Recente
              </Text>

              {history.length === 0 && (
                <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                  Nenhum consumo registrado ainda.
                </Text>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.histCard,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontWeight: "900", color: colors.textPrimary }}>
                  -{item.gramsUsed}g
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {new Date(item.createdAt).toLocaleDateString("pt-BR")}{" "}
                  {new Date(item.createdAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </View>
          )}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 18, fontWeight: "900" },
  h2: {
    marginTop: 6,
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
});
