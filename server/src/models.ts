export type ModelVendor = "openai" | "anthropic";

export const MODELS: Record<
  string,
  {
    vendor: ModelVendor;
    model: string;
  }
> = {
  "gpt-4.1": {
    vendor: "openai",
    model: "gpt-4.1",
  },
  "gpt-4.1-mini": {
    vendor: "openai",
    model: "gpt-4.1-mini",
  },
  "o4-mini": {
    vendor: "openai",
    model: "o4-mini",
  },
  o3: {
    vendor: "openai",
    model: "o3",
  },
  "claude-opus-4": {
    vendor: "anthropic",
    model: "claude-opus-4-20250514",
  },
  "claude-sonnet-4": {
    vendor: "anthropic",
    model: "claude-sonnet-4-20250514",
  },
  "claude-3-7-sonnet": {
    vendor: "anthropic",
    model: "claude-3-7-sonnet-latest",
  },
};
