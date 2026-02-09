import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../ui/theme/ThemeContext";
import { Pressable } from "react-native";

import type {
  RootTabParamList,
  FilamentsStackParamList,
  ProductsStackParamList,
  SalesStackParamList,
} from "./types";

import { FilamentsListScreen } from "../screens/Filaments/FilamentsListScreen";
import { FilamentFormScreen } from "../screens/Filaments/FilamentFormScreen";
import { FilamentConsumptionScreen } from "../screens/Filaments/FilamentConsumptionScreen";

import { ProductsListScreen } from "../screens/Products/ProductsListScreen";
import { ProductFormScreen } from "../screens/Products/ProductFormScreen";
import { ProductQueueScreen } from "../screens/Products/ProductQueueScreen";

import { SalesListScreen } from "../screens/Sales/SalesListScreen";
import { SaleFormScreen } from "../screens/Sales/SaleFormScreen";

import { SettingsScreen } from "../screens/Settings/SettingsScreen";
import { CostParametersScreen } from "../screens/Settings/CostParametersScreen";
import { AccessoryFormScreen } from "../screens/Settings/AccessoryFormScreen";
import { AccessoriesListScreen } from "../screens/Settings/AccessoriesListScreen";

const Tab = createBottomTabNavigator<RootTabParamList>();

const FilamentsStack = createNativeStackNavigator<FilamentsStackParamList>();
const ProductsStack = createNativeStackNavigator<ProductsStackParamList>();
const SalesStack = createNativeStackNavigator<SalesStackParamList>();

function FilamentsStackNavigator() {
  const { colors } = useTheme();

  return (
    <FilamentsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.textPrimary },
        headerTintColor: colors.textPrimary,
      }}
    >
      <FilamentsStack.Screen
        name="FilamentsList"
        component={FilamentsListScreen}
        options={{ headerShown: false }}
      />

      <FilamentsStack.Screen
        name="FilamentForm"
        component={FilamentFormScreen}
        options={{ title: "Filamento" }}
      />
      <FilamentsStack.Screen
        name="FilamentConsumption"
        component={FilamentConsumptionScreen}
        options={{ title: "Consumo" }}
      />
    </FilamentsStack.Navigator>
  );
}

function ProductsStackNavigator() {
  const { colors } = useTheme();

  return (
    <ProductsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.textPrimary },
        headerTintColor: colors.textPrimary,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <ProductsStack.Screen
        name="ProductsList"
        component={ProductsListScreen}
        options={({ navigation }) => ({
          title: "Produtos",
          headerRight: () => (
            <Pressable
              onPress={() => navigation.navigate("ProductQueue")}
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.iconBg,
                alignItems: "center",
                justifyContent: "center",
              }}
              hitSlop={10}
            >
              <MaterialIcons
                name="view-list"
                size={20}
                color={colors.textPrimary}
              />
            </Pressable>
          ),
        })}
      />

      <ProductsStack.Screen
        name="ProductQueue"
        component={ProductQueueScreen}
        options={{ title: "Fila de Impressão" }}
      />

      <ProductsStack.Screen
        name="ProductForm"
        component={ProductFormScreen}
        options={{ title: "Produto" }}
      />
    </ProductsStack.Navigator>
  );
}

function SalesStackNavigator() {
  const { colors } = useTheme();

  return (
    <SalesStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.textPrimary },
        headerTintColor: colors.textPrimary,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <SalesStack.Screen
        name="SalesList"
        component={SalesListScreen}
        options={{ title: "Vendas" }}
      />
      <SalesStack.Screen
        name="SaleForm"
        component={SaleFormScreen}
        options={{ title: "Venda" }}
      />
    </SalesStack.Navigator>
  );
}

const SettingsStack = createNativeStackNavigator();

function SettingsStackNavigator() {
  const { colors } = useTheme();
  return (
    <SettingsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.textPrimary },
        headerTintColor: colors.textPrimary,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <SettingsStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Configurações" }}
      />
      <SettingsStack.Screen
        name="CostParameters"
        component={CostParametersScreen}
        options={{ title: "Parâmetros" }}
      />
      <SettingsStack.Screen
        name="AccessoryForm"
        component={AccessoryFormScreen}
        options={{ title: "Acessório" }}
      />

      <SettingsStack.Screen
        name="AccessoriesList"
        component={AccessoriesListScreen}
        options={{ title: "Acessórios e Extras" }}
      />
    </SettingsStack.Navigator>
  );
}

function TabsNavigator() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tab.Screen
        name="FilamentsTab"
        component={FilamentsStackNavigator}
        options={{
          title: "Filamentos",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="inventory" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProductsTab"
        component={ProductsStackNavigator}
        options={{
          title: "Produtos",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="widgets" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SalesTab"
        component={SalesStackNavigator}
        options={{
          title: "Vendas",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="shopping-cart" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsStackNavigator}
        options={{
          title: "Config",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
export function AppNavigator() {
  return <TabsNavigator />;
}
