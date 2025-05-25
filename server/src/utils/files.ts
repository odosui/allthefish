import fs from "fs/promises";

export async function isDirExists(dir: string) {
  return await fs
    .access(dir)
    .then(() => true)
    .catch(() => false);
}
