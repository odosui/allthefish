import fs from "fs/promises";

export async function isDirExists(dir: string) {
  return await fs
    .access(dir)
    .then(() => true)
    .catch(() => false);
}

export async function listFiles(
  root: string,
  ignorePatterns: string[],
): Promise<string[]> {
  const base = root;
  // List files recursively in the specified directory
  const files = await listFilesRecursively(root);
  return files
    .filter((file) => {
      // check filepath agains ignore regex patterns
      return !ignorePatterns.some((pattern) => {
        const regex = new RegExp(pattern);
        return regex.test(file);
      });
    })
    .map((file) => file.replace(base + "/", ""));
}

async function listFilesRecursively(root: string): Promise<string[]> {
  const base = root;

  const files: string[] = [];
  const entries = await fs.readdir(base, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = `${base}/${entry.name}`;

    // ignore hidden files and directories
    if (entry.name.startsWith(".")) {
      continue;
    }

    if (entry.isDirectory()) {
      // Skip ignored directories
      const subFiles = await listFilesRecursively(`${root}/${entry.name}`);
      files.push(...subFiles);
    } else {
      // Add file to the list
      files.push(fullPath);
    }
  }

  return files;
}

export async function readFileToJson<T>(filePath: string): Promise<T | null> {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as T;
  } catch (error) {
    console.error(`Error reading or parsing file ${filePath}:`, error);
    return null;
  }
}
