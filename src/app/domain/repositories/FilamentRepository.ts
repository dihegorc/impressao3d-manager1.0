import { STORAGE_KEYS } from "../../core/storage/keys";
import { getJSON, setJSON } from "../../core/storage/storage";
import { Filament } from "../models/Filament";

const empty: Filament[] = [];

export const FilamentRepository = {
  async list(): Promise<Filament[]> {
    return getJSON<Filament[]>(STORAGE_KEYS.FILAMENTS, empty);
  },

  async getById(id: string): Promise<Filament | undefined> {
    const all = await this.list();
    return all.find((f) => f.id === id);
  },

  async upsert(item: Filament): Promise<void> {
    const all = await this.list();
    const idx = all.findIndex((f) => f.id === item.id);
    if (idx >= 0) all[idx] = item;
    else all.unshift(item);
    await setJSON(STORAGE_KEYS.FILAMENTS, all);
  },

  async remove(id: string): Promise<void> {
    const all = await this.list();
    await setJSON(
      STORAGE_KEYS.FILAMENTS,
      all.filter((f) => f.id !== id),
    );
  },
};
