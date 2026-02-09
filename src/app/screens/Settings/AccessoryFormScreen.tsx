import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Screen } from "../../ui/components/Screen";
import { AppInput } from "../../ui/components/AppInput";
import { AppButton } from "../../ui/components/AppButton";
import { useTheme } from "../../ui/theme/ThemeContext";
import { AccessoryRepository } from "../../domain/repositories/AccessoryRepository";
import { uid } from "../../core/utils/uuid";
import { SettingsStackParamList } from "../../navigation/types";

type Route = RouteProp<SettingsStackParamList, "AccessoryForm">;

function toNumber(v: string) {
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) ? 0 : n;
}

export function AccessoryFormScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const id = route.params?.id;

  const [name, setName] = useState("");
  const [cost, setCost] = useState("");

  useEffect(() => {
    if (id) {
      AccessoryRepository.list().then((items) => {
        const item = items.find((i) => i.id === id);
        if (item) {
          setName(item.name);
          setCost(String(item.cost));
        }
      });
    }
  }, [id]);

  async function save() {
    if (!name.trim()) return Alert.alert("Erro", "Nome é obrigatório");

    await AccessoryRepository.upsert({
      id: id ?? uid(),
      name: name.trim(),
      cost: toNumber(cost),
    });
    navigation.goBack();
  }

  async function remove() {
    if (!id) return;
    await AccessoryRepository.remove(id);
    navigation.goBack();
  }

  return (
    <Screen>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {id ? "Editar Acessório" : "Novo Acessório"}
      </Text>

      <View style={{ gap: 16, marginTop: 20 }}>
        <AppInput
          label="Nome do Item"
          value={name}
          onChangeText={setName}
          placeholder="Ex: Argola de Chaveiro"
        />
        <AppInput
          label="Custo Unitário (R$)"
          value={cost}
          onChangeText={setCost}
          keyboardType="numeric"
          placeholder="0,00"
        />

        <AppButton title="Salvar" onPress={save} />

        {id && (
          <AppButton
            title="Excluir"
            onPress={remove}
            variant="ghost"
            style={{ marginTop: 10 }}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "900" },
});
