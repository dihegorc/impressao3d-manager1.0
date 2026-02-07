import { v4 as uuidv4 } from "uuid";

export function uid(): string {
  return uuidv4();
}
