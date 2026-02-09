export type RootTabParamList = {
  FilamentsTab: undefined;
  ProductsTab: undefined;
  SalesTab: undefined;
  SettingsTab: undefined;
  PrintQueueTab: undefined;
};

export type FilamentsStackParamList = {
  FilamentsList: { openColorFilter?: boolean } | undefined;
  FilamentForm:
    | {
        id?: string;
        prefill?: {
          material: string;
          color: string;
          brand?: string;
          priceBRL?: number;
        };
        lockPrefill?: boolean;
      }
    | undefined;
  FilamentConsumption: { groupKey: string };
};

export type ProductsStackParamList = {
  ProductsList: undefined;
  ProductForm: { id?: string } | undefined;
  ProductQueue: undefined;
};

export type SalesStackParamList = {
  SalesList: undefined;
  SaleForm: { id?: string } | undefined;
};

export type SettingsStackParamList = {
  SettingsList: undefined;
  CostParameters: undefined;
  AccessoriesList: undefined;
  AccessoryForm: { id?: string } | undefined;
  ThemeSelection: undefined;
};
