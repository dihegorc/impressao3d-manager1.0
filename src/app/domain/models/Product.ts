// domain/models/Product.ts

export type ProductFilament = {
  material: string;
  color: string;
  brand?: string;
  grams: number;
  plateMinutes: number;
};

export type ProductAccessory = {
  name: string;
  quantity: number;
};

export type ProductStatus =
  | "queued" // Na fila
  | "printing" // Imprimindo
  | "finishing" // Retoques finais
  | "ready"; // Pronto / estoque

export interface Product {
  id: string;
  name: string;
  description?: string;
  photoUri?: string;
  priceBRL: number;

  // Receita de filamento (1 ou várias cores)
  filaments: ProductFilament[];

  accessories?: ProductAccessory[];

  // Controle de produção (fila)
  status: ProductStatus;
  queuePosition?: number;

  // Produção
  quantity?: number;
  estimatedMinutes?: number;
  startedAt?: string;
  finishedAt?: string;

  createdAt: string;
  updatedAt: string;
}
