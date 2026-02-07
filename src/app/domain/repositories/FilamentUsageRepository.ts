import { STORAGE_KEYS } from "../../core/storage/keys";
import { getJSON, setJSON } from "../../core/storage/storage";
import { FilamentUsage } from "../models/FilamentUsage";

const empty: FilamentUsage[] = [];

export const FilamentUsageRepository = {
  async list(): Promise<FilamentUsage[]> {
    return getJSON<FilamentUsage[]>(STORAGE_KEYS.FILAMENT_USAGE, empty);
  },

  async listByGroup(groupKey: string): Promise<FilamentUsage[]> {
    const all = await this.list();
    return all
      .filter((u) => u.groupKey === groupKey)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)); // mais recente primeiro
  },

  async add(item: FilamentUsage): Promise<void> {
    const all = await this.list();
    all.unshift(item);
    await setJSON(STORAGE_KEYS.FILAMENT_USAGE, all);
  },
};
