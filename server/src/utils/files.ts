import fs from "fs/promises";

export async function isDirExists(dir: string) {
  return await fs
    .access(dir)
    .then(() => true)
    .catch(() => false);
}

export async function listFiles(
  root: string,
  dir: string,
  ignoreDirs: string[],
): Promise<string[]> {
  const base = root + "/" + dir;
  // List files recursively in the specified directory
  const files = await listFilesRecursively(root, dir, ignoreDirs);
  return files.map((file) => file.replace(`${base}/`, ""));
}

async function listFilesRecursively(
  root: string,
  dir: string,
  ignoreDirs: string[],
): Promise<string[]> {
  const base = root + "/" + dir;

  const files: string[] = [];
  const entries = await fs.readdir(base, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = `${base}/${entry.name}`;
    if (entry.isDirectory()) {
      // Skip ignored directories
      if (!ignoreDirs.includes(entry.name)) {
        // Recursively list files in subdirectory
        const subFiles = await listFilesRecursively(
          root,
          `${dir}/${entry.name}`,
          ignoreDirs,
        );
        files.push(...subFiles);
      }
    } else {
      // Add file to the list
      files.push(fullPath);
    }
  }

  return files;
}
