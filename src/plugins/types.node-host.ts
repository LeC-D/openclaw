// Node-host plugin command contracts, including the opt-in duplex transport.
import type { OpenClawConfig } from "../config/types.openclaw.js";

export type OpenClawPluginNodeHostCommandAvailabilityContext = {
  /** Node-local configuration used to build this host's Gateway declaration. */
  config: OpenClawConfig;
  /** Node-host process environment. */
  env: NodeJS.ProcessEnv;
};

export type OpenClawPluginNodeHostCommandIo = {
  emitChunk(chunk: string): Promise<void>;
  onInput(callback: (payloadJSON: string) => void): void;
  signal: AbortSignal;
};

type OpenClawPluginNodeHostCommandBase = {
  command: string;
  cap?: string;
  dangerous?: boolean;
  /** Return false to omit this command and capability from the node declaration. */
  isAvailable?: (context: OpenClawPluginNodeHostCommandAvailabilityContext) => boolean;
  agentTool?: {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
    /** Platforms where this tool is allowlisted by default; omit for explicit config only. */
    defaultPlatforms?: Array<"ios" | "android" | "macos" | "windows" | "linux" | "unknown">;
    mcp?: { server: string; tool: string };
  };
};

export type OpenClawPluginNodeHostCommand = OpenClawPluginNodeHostCommandBase &
  (
    | {
        duplex: true;
        handle: (
          paramsJSON: string | null | undefined,
          io: OpenClawPluginNodeHostCommandIo,
        ) => Promise<string>;
      }
    | {
        duplex?: false;
        handle: (paramsJSON?: string | null) => Promise<string>;
      }
  );
