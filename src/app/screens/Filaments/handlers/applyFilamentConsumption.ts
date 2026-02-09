import { Alert } from "react-native";
import type { Filament } from "../../../domain/models/Filament";
import { FilamentRepository } from "../../../domain/repositories/FilamentRepository";
import { FilamentUsageRepository } from "../../../domain/repositories/FilamentUsageRepository";

type NavLike = {
  popToTop: () => void;
};

type FilamentUsageLike = {
  id: string;
  groupKey: string;
  gramsUsed: number;
  note?: string;
  createdAt: string;
};

type Params = {
  groupKey: string;

  // state atual
  spools: Filament[];
  grams: string;
  note: string;

  // setters da tela
  setSpools: (v: Filament[]) => void;
  setHistory: React.Dispatch<React.SetStateAction<FilamentUsageLike[]>>;
  setShowHistory: (v: boolean) => void;
  setGrams: (v: string) => void;
  setNote: (v: string) => void;

  // helpers
  load: () => Promise<void>;
  navigation: NavLike;
};

function parseGrams(input: string): number {
  const cleaned = (input ?? "").replace(",", ".").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Consumo FIFO:
 * - Atualiza a UI imediatamente (estado imutável)
 * - Persiste no storage
 * - Mostra o alert de "adicionar outro consumo?" (com setTimeout)
 */
export async function applyFilamentConsumption({
  groupKey,
  spools,
  grams,
  note,
  setSpools,
  setHistory,
  setShowHistory,
  setGrams,
  setNote,
  load,
  navigation,
}: Params) {
  const g = parseGrams(grams);

  if (!Number.isFinite(g) || g <= 0) {
    Alert.alert("Validação", "Informe um consumo válido em gramas.");
    return;
  }

  const totalAvailable = spools.reduce(
    (s, f) => s + (f.weightCurrentG ?? 0),
    0,
  );

  if (g > totalAvailable) {
    Alert.alert(
      "Sem saldo",
      `Consumo maior que o disponível.\nDisponível: ${totalAvailable}g.`,
    );
    return;
  }

  Alert.alert("Confirmar consumo", `Descontar ${g}g deste grupo?`, [
    { text: "Cancelar", style: "cancel" },
    {
      text: "Confirmar",
      onPress: async () => {
        const now = new Date().toISOString();

        // 1) Monta novo estado IMUTÁVEL (FIFO)
        let remaining = g;

        const ordered = [...spools].sort((a, b) =>
          (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
        );

        const nextSpools: Filament[] = [];
        const toRemoveIds: string[] = [];
        const toUpsert: Filament[] = [];

        for (const spool of ordered) {
          if (remaining <= 0) {
            nextSpools.push(spool);
            continue;
          }

          const current = spool.weightCurrentG ?? 0;
          const take = Math.min(current, remaining);
          const newWeight = current - take;
          remaining -= take;

          if (newWeight <= 0) {
            toRemoveIds.push(spool.id);
          } else {
            const updated: Filament = {
              ...spool,
              weightCurrentG: newWeight,
              updatedAt: now,
            };
            nextSpools.push(updated);
            toUpsert.push(updated);
          }
        }

        // 2) Atualiza UI NA HORA (resolve “só atualiza quando volta”)
        setSpools(nextSpools);

        // 3) Atualiza histórico imediatamente (otimista)
        const usageItem: FilamentUsageLike = {
          id: uid(),
          groupKey,
          gramsUsed: g,
          note: note.trim() || undefined,
          createdAt: now,
        };

        setHistory((h) => [usageItem, ...h]);
        setShowHistory(true);

        // 4) Persiste no storage
        try {
          for (const id of toRemoveIds) {
            await FilamentRepository.remove(id);
          }

          for (const f of toUpsert) {
            await FilamentRepository.upsert(f);
          }

          await FilamentUsageRepository.add(usageItem as any);

          // sincroniza (garante consistência)
          await load();
        } catch (e) {
          console.log("applyFilamentConsumption -> erro ao persistir:", e);
          Alert.alert("Erro", "Falha ao salvar o consumo. Veja o console.");
          return;
        }

        // 5) Segundo Alert: setTimeout (resolve “alert não aparece”)
        setTimeout(() => {
          Alert.alert(
            "Consumo registrado ✅",
            "Deseja registrar outro consumo?",
            [
              {
                text: "Sim",
                onPress: () => {
                  setGrams("");
                  setNote("");
                },
              },
              {
                text: "Não",
                style: "cancel",
                onPress: () => navigation.popToTop(),
              },
            ],
          );
        }, 150);
      },
    },
  ]);
}
