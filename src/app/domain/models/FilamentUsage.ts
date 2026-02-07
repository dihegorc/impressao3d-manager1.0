export type FilamentUsage = {
  id: string;
  groupKey: string; // material|color|brand
  gramsUsed: number; // consumo em gramas
  note?: string; // ex: "Chaveiro Heitor", "Suporte GoPro"
  createdAt: string; // ISO
};
