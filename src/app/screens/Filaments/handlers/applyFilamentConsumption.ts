import { Filament } from "../../../domain/models/Filament";
import { FilamentRepository } from "../../../domain/repositories/FilamentRepository";
import { FilamentUsageRepository } from "../../../domain/repositories/FilamentUsageRepository";

// Função auxiliar para gerar ID único
function uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Gera a chave de grupo baseada no filamento (Material|Cor|Marca)
function getGroupKey(f: Filament) {
  const m = f.material.trim().toLowerCase();
  const c = f.color.trim().toLowerCase();
  const b = (f.brand ?? "").trim().toLowerCase();
  return `${m}|${c}|${b}`;
}

/**
 * Lógica pura de consumo (FIFO):
 * 1. Ordena os carretéis por data (mais antigos primeiro).
 * 2. Abate o peso sequencialmente.
 * 3. Remove os vazios e atualiza os restantes no banco.
 * 4. Regista o histórico.
 */
export async function applyFilamentConsumption(
  spools: Filament[],
  grams: number,
): Promise<void> {
  const now = new Date().toISOString();
  let remaining = grams;

  // Clona e ordena por data de criação (FIFO - First In, First Out)
  // Assim consumimos primeiro os carretéis mais antigos
  const ordered = [...spools].sort((a, b) =>
    (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
  );

  const toRemoveIds: string[] = [];
  const toUpsert: Filament[] = [];

  // Se não houver carretéis, aborta
  if (ordered.length === 0) return;

  // Deriva o groupKey do primeiro item (assumindo que todos são do mesmo grupo)
  const groupKey = getGroupKey(ordered[0]);

  for (const spool of ordered) {
    if (remaining <= 0) break; // Já consumiu tudo o que precisava

    const current = spool.weightCurrentG;

    // Consome o máximo possível deste carretel
    const take = Math.min(current, remaining);
    const newWeight = current - take;
    remaining -= take;

    if (newWeight <= 0) {
      // Se zerou (ou ficou negativo), marcamos para remover
      toRemoveIds.push(spool.id);
    } else {
      // Se sobrou, atualizamos o peso e a data de modificação
      toUpsert.push({
        ...spool,
        weightCurrentG: newWeight,
        updatedAt: now,
      });
    }
  }

  // 1. Remove carretéis que ficaram vazios
  for (const id of toRemoveIds) {
    await FilamentRepository.remove(id);
  }

  // 2. Atualiza carretéis que sobraram com novo peso
  for (const f of toUpsert) {
    await FilamentRepository.upsert(f);
  }

  // 3. Adiciona ao histórico de consumo
  await FilamentUsageRepository.add({
    id: uid(),
    groupKey,
    gramsUsed: grams,
    createdAt: now,
    // note: "" // Caso queiras voltar a usar nota no futuro, adiciona aqui
  });
}
