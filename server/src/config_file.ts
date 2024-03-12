import fs from "fs/promises";

export type IConfigFile = {
  openai_key: string;
  anthropic_key: string;
  projects_dir: string;
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
    try {
      const configFile = await fs.readFile("config.json", "utf-8");
      return JSON.parse(configFile) as IConfigFile;
    } catch (error) {
      console.error("Failed to read configuration file:", error);
      return null;
    }
  },

  readProfiles: async () => {
    try {
      const configFile = await fs.readFile("config.json", "utf-8");
      const config: IConfigFile = JSON.parse(configFile);
      return Object.keys(config.profiles);
    } catch (error) {
      console.error("Failed to read configuration file:", error);
      return null;
    }
  },
};

export default ConfigFile;
