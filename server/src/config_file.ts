import { TemplateName } from "./project_worker";
import { readFileToJson } from "./utils/files";

export type IConfigFile = {
  openai_key: string;
  anthropic_key: string;
  profiles: Record<
    string,
    {
      vendor: "openai" | "anthropic";
      model: string;
    }
  >;
};

const ConfigFile = {
  readConfig: async () => {
    return await readFileToJson<IConfigFile>("config.json");
  },
};

export default ConfigFile;

export const readLocalConfig = async (path: string) => {
  const configFile = path + "/.allthefish.json";
  const json = await readFileToJson<{
    port: number;
    template: TemplateName;
  }>(configFile);
  return json ? json : null;
};
