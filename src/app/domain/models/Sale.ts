export type SaleItem = {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
};

export type Sale = {
  id: string;
  dateISO: string; // new Date().toISOString()
  items: SaleItem[];
  total: number;
  paymentMethod?: "PIX" | "DINHEIRO" | "CARTAO" | "OUTRO";
  createdAt: string;
  updatedAt: string;
};
