export interface ProductFilament {
  material: string;
  color: string;
  brand?: string;
  grams: number;
}

export interface PrintPlate {
  id: string;
  name: string;
  estimatedMinutes: number;
  unitsOnPlate: number; // Rendimento: Quantas unidades saem desta plate?
  filaments: ProductFilament[];
}

export interface ProductAccessory {
  name: string;
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  photoUri?: string;

  // Estrutura de Engenharia (BOM)
  plates: PrintPlate[];
  accessories: ProductAccessory[];

  // Financeiro
  priceBRL: number;

  // Controle de Produção
  status: "ready" | "queued" | "printing";

  // --- CORREÇÃO: Adicionado de volta como Opcional ---
  // Serve como cache/snapshot do tempo total para itens na fila
  estimatedMinutes?: number;

  queuePosition?: number;
  quantity?: number;

  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
  batchId?: string;
  activePlateIndex?: number;
}
