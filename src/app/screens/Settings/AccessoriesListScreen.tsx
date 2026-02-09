import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { Screen } from "../../ui/components/Screen";
import { useTheme } from "../../ui/theme/ThemeContext";
import { AccessoryRepository } from "../../domain/repositories/AccessoryRepository";
import { Accessory } from "../../domain/models/Accessory";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SettingsStackParamList } from "../../navigation/types";

function toMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function AccessoriesListScreen() {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const [items, setItems] = useState<Accessory[]>([]);

  useFocusEffect(
    useCallback(() => {
      AccessoryRepository.list().then(setItems);
    }, []),
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Meus Acessórios
        </Text>
        <Pressable
          onPress={() => navigation.navigate("AccessoryForm")}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <MaterialIcons name="add" size={24} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 20 }}
        ListEmptyComponent={
          <Text style={{ color: colors.textSecondary, marginTop: 20 }}>
            Nenhum acessório cadastrado.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              navigation.navigate("AccessoryForm", { id: item.id })
            }
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View>
              <Text style={[styles.name, { color: colors.textPrimary }]}>
                {item.name}
              </Text>
            </View>
            <Text style={[styles.cost, { color: colors.textPrimary }]}>
              {toMoney(item.cost)}
            </Text>
            <MaterialIcons
              name="chevron-right"
              size={24}
              color={colors.textSecondary}
            />
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: "900" },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  name: { fontSize: 16, fontWeight: "bold" },
  cost: { fontSize: 16, fontWeight: "bold", marginLeft: "auto" },
});
