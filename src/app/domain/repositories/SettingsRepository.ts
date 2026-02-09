import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "settings:v1";

export interface AppSettings {
  // Energia
  powerWatts: number; // Potência da impressora (W)
  energyCostKwh: number; // Custo do kWh (R$)

  // Depreciação
  printerPrice: number; // Valor da impressora (R$)
  lifespanHours: number; // Vida útil (horas)

  // Custos Fixos Administrativos
  monthlyFixedCost: number; // Total de custos fixos (R$)
  monthlyPrintHours: number; // Capacidade produtiva estimada (horas/mês) ou Peças/mês
  // Nota: Sua planilha usa "Unidades/mês" (135). Vamos usar horas para ser mais preciso,
  // ou manter unidades se preferir. Vou usar horas para diluir melhor.

  // Outros
  failureRate: number; // Taxa de falha (%)
  defaultMarkup: number; // Markup padrão (%)
}

const DEFAULT_SETTINGS: AppSettings = {
  powerWatts: 350,
  energyCostKwh: 0.97,
  printerPrice: 4500,
  lifespanHours: 20000,
  monthlyFixedCost: 300,
  monthlyPrintHours: 200, // Estimativa de 200h/mês
  failureRate: 10,
  defaultMarkup: 200,
};

export const SettingsRepository = {
  async get(): Promise<AppSettings> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return DEFAULT_SETTINGS;
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  async save(settings: AppSettings): Promise<void> {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  },
};
