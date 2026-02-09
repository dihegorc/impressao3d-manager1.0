import React, { useCallback, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Screen } from "../../ui/components/Screen";
import { AppInput } from "../../ui/components/AppInput";
import { AppButton } from "../../ui/components/AppButton";
import { useTheme } from "../../ui/theme/ThemeContext";
import {
  SettingsRepository,
  AppSettings,
} from "../../domain/repositories/SettingsRepository";

function toNumber(v: string) {
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) ? 0 : n;
}

export function CostParametersScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);

  const [power, setPower] = useState("");
  const [kwh, setKwh] = useState("");
  const [printerPrice, setPrinterPrice] = useState("");
  const [lifespan, setLifespan] = useState("");
  const [fixedCost, setFixedCost] = useState("");
  const [monthlyHours, setMonthlyHours] = useState("");
  const [failure, setFailure] = useState("");
  const [markup, setMarkup] = useState("");

  const load = useCallback(async () => {
    const s = await SettingsRepository.get();
    setPower(String(s.powerWatts));
    setKwh(String(s.energyCostKwh));
    setPrinterPrice(String(s.printerPrice));
    setLifespan(String(s.lifespanHours));
    setFixedCost(String(s.monthlyFixedCost));
    setMonthlyHours(String(s.monthlyPrintHours));
    setFailure(String(s.failureRate));
    setMarkup(String(s.defaultMarkup));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function save() {
    setLoading(true);
    try {
      const settings: AppSettings = {
        powerWatts: toNumber(power),
        energyCostKwh: toNumber(kwh),
        printerPrice: toNumber(printerPrice),
        lifespanHours: toNumber(lifespan),
        monthlyFixedCost: toNumber(fixedCost),
        monthlyPrintHours: toNumber(monthlyHours),
        failureRate: toNumber(failure),
        defaultMarkup: toNumber(markup),
      };
      await SettingsRepository.save(settings);
      Alert.alert("Sucesso", "Parâmetros atualizados!");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Erro", "Falha ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Parâmetros de Custo
          </Text>

          <View style={styles.section}>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Energia
            </Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <AppInput
                  label="Potência (W)"
                  value={power}
                  onChangeText={setPower}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <AppInput
                  label="Custo kWh (R$)"
                  value={kwh}
                  onChangeText={setKwh}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Depreciação
            </Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <AppInput
                  label="Valor Máquina (R$)"
                  value={printerPrice}
                  onChangeText={setPrinterPrice}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <AppInput
                  label="Vida Útil (Horas)"
                  value={lifespan}
                  onChangeText={setLifespan}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Fixos / Administrativos
            </Text>
            <AppInput
              label="Custo Fixo Mensal (R$)"
              value={fixedCost}
              onChangeText={setFixedCost}
              keyboardType="numeric"
            />
            <AppInput
              label="Capacidade (Horas/Mês)"
              value={monthlyHours}
              onChangeText={setMonthlyHours}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Padrões
            </Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <AppInput
                  label="Taxa Falha (%)"
                  value={failure}
                  onChangeText={setFailure}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <AppInput
                  label="Markup Padrão (%)"
                  value={markup}
                  onChangeText={setMarkup}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          <AppButton
            title={loading ? "Salvando..." : "Salvar e Voltar"}
            onPress={save}
            disabled={loading}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "900", marginBottom: 8 },
  subtitle: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  section: {
    gap: 8,
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  row: { flexDirection: "row", gap: 12 },
});
