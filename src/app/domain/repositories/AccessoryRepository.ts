import AsyncStorage from "@react-native-async-storage/async-storage";
import { Accessory } from "../models/Accessory";

const KEY = "accessories:v1";

async function readAll(): Promise<Accessory[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

async function writeAll(items: Accessory[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export const AccessoryRepository = {
  async list(): Promise<Accessory[]> {
    const items = await readAll();
    return items.sort((a, b) => a.name.localeCompare(b.name));
  },

  async upsert(item: Accessory): Promise<void> {
    const items = await readAll();
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) items[idx] = item;
    else items.push(item);
    await writeAll(items);
  },

  async remove(id: string): Promise<void> {
    const items = await readAll();
    await writeAll(items.filter((i) => i.id !== id));
  },
};
