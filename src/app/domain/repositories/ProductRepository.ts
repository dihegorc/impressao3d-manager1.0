import AsyncStorage from "@react-native-async-storage/async-storage";
import { Product } from "../models/Product";

const KEY = "products:v1";

async function readAll(): Promise<Product[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Product[];
  } catch {
    return [];
  }
}

async function writeAll(items: Product[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export const ProductRepository = {
  async list(): Promise<Product[]> {
    const items = await readAll();
    return items.sort((a, b) => a.name.localeCompare(b.name));
  },

  async getById(id: string): Promise<Product | undefined> {
    const items = await readAll();
    return items.find((p) => p.id === id);
  },

  async upsert(product: Product): Promise<void> {
    const items = await readAll();
    const idx = items.findIndex((p) => p.id === product.id);
    if (idx >= 0) items[idx] = product;
    else items.push(product);
    await writeAll(items);
  },

  async remove(id: string): Promise<void> {
    const items = await readAll();
    await writeAll(items.filter((p) => p.id !== id));
  },
};
