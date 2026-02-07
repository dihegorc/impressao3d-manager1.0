import AsyncStorage from "@react-native-async-storage/async-storage";
import { PrintJob } from "../models/PrintJob";

const KEY = "printJobs:v1";

async function readAll(): Promise<PrintJob[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PrintJob[];
  } catch {
    return [];
  }
}

async function writeAll(items: PrintJob[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export const PrintJobRepository = {
  async list(): Promise<PrintJob[]> {
    const items = await readAll();
    return items.sort((a, b) => a.queuePosition - b.queuePosition);
  },

  async getById(id: string): Promise<PrintJob | undefined> {
    const items = await readAll();
    return items.find((x) => x.id === id);
  },

  async upsert(job: PrintJob): Promise<void> {
    const items = await readAll();
    const idx = items.findIndex((x) => x.id === job.id);
    if (idx >= 0) items[idx] = job;
    else items.push(job);
    await writeAll(items);
  },

  async remove(id: string): Promise<void> {
    const items = await readAll();
    await writeAll(items.filter((x) => x.id !== id));
  },

  async bumpPositionsFrom(position: number): Promise<void> {
    const items = await readAll();
    const updated = items.map((j) =>
      j.queuePosition >= position
        ? { ...j, queuePosition: j.queuePosition + 1 }
        : j,
    );
    await writeAll(updated);
  },
};
