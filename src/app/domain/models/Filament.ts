export type FilamentMaterial =
  | "PLA"
  | "ABS"
  | "PETG"
  | "TPU"
  | "RESINA"
  | "OUTRO";

export type Filament = {
  id: string;
  name: string; // ex: "PLA Branco - Bambu"
  material: FilamentMaterial;
  color: string;
  brand?: string;
  weightInitialG: number;
  weightCurrentG: number;
  cost?: number;
  createdAt: string;
  updatedAt: string;
  priceBRL?: number;
};
