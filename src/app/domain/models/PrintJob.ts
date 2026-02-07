export type PrintJobStatus = "queued" | "printing" | "finishing" | "ready";

export interface PrintJob {
  id: string;

  productId: string;
  productNameSnapshot: string;

  customerName?: string;
  quantity: number;

  status: PrintJobStatus;

  // fila
  queuePosition: number;

  // impressão
  estimatedMinutes?: number;
  startedAt?: string;
  etaAt?: string;
  finishedAt?: string;

  // controle
  consumptionApplied?: boolean;

  createdAt: string;
  updatedAt: string;
}
