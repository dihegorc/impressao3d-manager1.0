import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { ConfirmModal } from "../../ui/components/ConfirmModal";

import type { FilamentsStackParamList } from "../../navigation/types";
import { Screen } from "../../ui/components/Screen";
import { AppInput } from "../../ui/components/AppInput";
import { AppButton } from "../../ui/components/AppButton";
import { FilamentMaterial } from "../../domain/models/Filament";
import { FilamentRepository } from "../../domain/repositories/FilamentRepository";
import { useTheme } from "../../ui/theme/ThemeContext";

type Nav = NativeStackNavigationProp<FilamentsStackParamList>;
type R = RouteProp<FilamentsStackParamList, "FilamentForm">;

function toNumber(v: string): number {
  const cleaned = v.replace(",", ".").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function buildFilamentName(material: string, color: string, brand: string) {
  const t = material.trim();
  const c = color.trim();
  const b = brand.trim();
  return b ? `${t} - ${c} - ${b}` : `${t} - ${c}`;
}

export function FilamentFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const tabBarHeight = useBottomTabBarHeight();
  const colors = useTheme().colors;

  const id = route.params?.id;
  const prefill = route.params?.prefill;

  const isEdit = useMemo(() => Boolean(id), [id]);

  const [saving, setSaving] = useState(false);
  const [material, setMaterial] = useState<FilamentMaterial>("PLA");
  const [color, setColor] = useState("");
  const [brand, setBrand] = useState("");
  const [weightInitial, setWeightInitial] = useState("");
  const [weightCurrent, setWeightCurrent] = useState("");
  const [cost, setCost] = useState("");
  const [spoolQty, setSpoolQty] = useState("1");
  const [unitWeight, setUnitWeight] = useState("1000");

  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean;
    id: string | null;
  }>({
    open: false,
    id: null,
  });

  const generatedName = useMemo(
    () => buildFilamentName(material, color, brand),
    [material, color, brand],
  );

  useEffect(() => {
    if (id) return;
    if (!prefill) return;

    const allowed = ["PLA", "ABS", "PETG", "TPU", "RESINA", "OUTRO"] as const;
    const match = allowed.includes(prefill.material as any)
      ? (prefill.material as any)
      : "PLA";

    setMaterial(match);
    setColor(prefill.color ?? "");
    setBrand(prefill.brand ?? "");
  }, [id, prefill]);

  function validate() {
    if (!color.trim()) return "Informe a cor.";
    if (!brand.trim()) return "Informe a marca do filamento.";

    if (!id) {
      const qty = toNumber(spoolQty);
      const uw = toNumber(unitWeight);

      if (!Number.isFinite(qty) || qty <= 0)
        return "Quantidade de carretéis inválida.";
      if (!Number.isInteger(qty))
        return "Quantidade de carretéis deve ser um número inteiro.";
      if (!Number.isFinite(uw) || uw <= 0) return "Peso unitário inválido.";
    } else {
      const wi = toNumber(weightInitial);
      const wc = toNumber(weightCurrent);
      if (!Number.isFinite(wi) || wi <= 0) return "Peso inicial inválido.";
      if (!Number.isFinite(wc) || wc < 0) return "Peso atual inválido.";
      if (wc > wi) return "Peso atual não pode ser maior que o peso inicial.";
    }

    const c = toNumber(cost);
    if (!cost.trim() || !Number.isFinite(c) || c <= 0) {
      return "Informe um custo válido (maior que zero).";
    }

    return null;
  }

  async function onSave() {
    if (saving) return;

    const err = validate();
    if (err) {
      Alert.alert("Atenção", err);
      return;
    }

    setSaving(true);

    try {
      const now = new Date().toISOString();
      const c = toNumber(cost);

      if (id) {
        const wi = toNumber(weightInitial);
        const wc = toNumber(weightCurrent);
        const existing = await FilamentRepository.getById(id);

        await FilamentRepository.upsert({
          id,
          name: generatedName,
          material,
          color: color.trim(),
          brand: brand.trim(),
          weightInitialG: wi,
          weightCurrentG: wc,
          cost: c,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        });

        navigation.goBack();
        return;
      }

      const qty = Math.trunc(toNumber(spoolQty));
      const uw = toNumber(unitWeight);

      for (let i = 0; i < qty; i++) {
        const newId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        await FilamentRepository.upsert({
          id: newId,
          name: generatedName,
          material,
          color: color.trim(),
          brand: brand.trim(),
          weightInitialG: uw,
          weightCurrentG: uw,
          cost: c,
          createdAt: now,
          updatedAt: now,
        });
      }

      navigation.goBack();
    } catch (e: any) {
      console.error("ERRO no onSave:", e);
      Alert.alert("Erro ao salvar", e?.message ?? "Erro desconhecido.");
    } finally {
      setSaving(false);
    }
  }

  function onChangeMaterialQuick(v: FilamentMaterial) {
    setMaterial(v);
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 16,
            paddingBottom: tabBarHeight + 24,
            gap: 12,
          }}
        >
          <View style={styles.page}>
            <Text style={[styles.h1, { color: colors.textPrimary }]}>
              {isEdit ? "Editar Filamento" : "Novo Filamento"}
            </Text>

            <View style={styles.preview}>
              <Text style={styles.previewLabel}>
                Nome do filamento (automático)
              </Text>
              <Text style={styles.previewValue}>{generatedName}</Text>
            </View>

            <View style={styles.form}>
              <AppInput
                label="Cor"
                value={color}
                onChangeText={setColor}
                placeholder="Ex: Branco"
              />

              <AppInput
                label="Marca"
                value={brand}
                onChangeText={setBrand}
                placeholder="Ex: Bambu / Voolt"
              />

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tipo de filamento</Text>
                <View style={styles.row}>
                  {(
                    [
                      "PLA",
                      "ABS",
                      "PETG",
                      "TPU",
                      "RESINA",
                      "OUTRO",
                    ] as FilamentMaterial[]
                  ).map((m) => (
                    <AppButton
                      key={m}
                      title={m}
                      variant={material === m ? "primary" : "ghost"}
                      onPress={() => onChangeMaterialQuick(m)}
                      style={styles.chip}
                    />
                  ))}
                </View>
              </View>

              {!id ? (
                <View style={styles.grid2}>
                  <View style={{ flex: 1 }}>
                    <AppInput
                      label="Qtd. de carretéis"
                      value={spoolQty}
                      onChangeText={setSpoolQty}
                      keyboardType="numeric"
                      placeholder="Ex: 3"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppInput
                      label="Peso unitário (g)"
                      value={unitWeight}
                      onChangeText={setUnitWeight}
                      keyboardType="numeric"
                      placeholder="Ex: 1000"
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.grid2}>
                  <View style={{ flex: 1 }}>
                    <AppInput
                      label="Peso inicial (g)"
                      value={weightInitial}
                      onChangeText={setWeightInitial}
                      keyboardType="numeric"
                      placeholder="Ex: 1000"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppInput
                      label="Peso atual (g)"
                      value={weightCurrent}
                      onChangeText={setWeightCurrent}
                      keyboardType="numeric"
                      placeholder="Ex: 850"
                    />
                  </View>
                </View>
              )}

              {!id ? (
                <Text style={styles.totalHint}>
                  Total estimado:{" "}
                  {(() => {
                    const qty = toNumber(spoolQty);
                    const uw = toNumber(unitWeight);
                    if (!Number.isFinite(qty) || !Number.isFinite(uw))
                      return "—";
                    const totalG = qty * uw;
                    return `${(totalG / 1000).toFixed(3).replace(".", ",")} kg`;
                  })()}
                </Text>
              ) : null}

              <AppInput
                label="Custo (R$)"
                value={cost}
                onChangeText={setCost}
                keyboardType="numeric"
                placeholder="Ex: 120"
              />

              <View style={styles.footer}>
                <AppButton title="Salvar" onPress={onSave} />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 18, fontWeight: "900", marginBottom: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  chip: { paddingVertical: 10, paddingHorizontal: 12 },
  grid2: { flexDirection: "row", gap: 12 },
  preview: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#fafafa",
    marginBottom: 6,
  },
  previewLabel: { color: "#666", fontSize: 12, fontWeight: "700" },
  previewValue: { marginTop: 6, fontSize: 16, fontWeight: "900" },
  page: { gap: 12 },
  form: { gap: 12, marginTop: 4 },
  section: { gap: 8, marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: "900" },
  footer: { marginTop: 8 },
  totalHint: { fontWeight: "800", marginTop: -4 },
});
