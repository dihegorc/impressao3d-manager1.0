import * as Linking from "expo-linking";

export const linking = {
  prefixes: [Linking.createURL("/")],
  config: {
    screens: {
      // Mapeia as Tabs
      FilamentsTab: {
        path: "filamentos", // URL: /filamentos
        screens: {
          FilamentsList: "", // /filamentos
          FilamentForm: "novo", // /filamentos/novo
          FilamentConsumption: "consumo", // /filamentos/consumo
        },
      },
      ProductsTab: {
        path: "produtos", // URL: /produtos
        screens: {
          ProductsList: "",
          ProductQueue: "fila",
          ProductForm: "detalhe",
        },
      },
      SalesTab: {
        path: "vendas", // URL: /vendas
        screens: {
          SalesList: "",
          SaleForm: "nova",
        },
      },
      SettingsTab: {
        path: "config", // URL: /config
        screens: {
          Settings: "",
          CostParameters: "parametros",
          AccessoriesList: "acessorios",
        },
      },
    },
  },
};
