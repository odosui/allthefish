import { TemplateName } from "./project_worker";
import { readFileToJson } from "./utils/files";

const CONFIG_FILE_NAME = ".allthefish.json";

export const readLocalConfig = async (path: string) => {
  const configFile = path + "/" + CONFIG_FILE_NAME;
  const json = await readFileToJson<{
    port: number;
    template: TemplateName;
  }>(configFile);
  return json ? json : null;
};
