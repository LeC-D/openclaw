// Claude catalog terminal ownership: validated local and paired-node resume plans.
import fs from "node:fs/promises";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import type { SessionCatalogTerminalPlan } from "openclaw/plugin-sdk/session-catalog";
import { CLAUDE_LOCAL_SESSION_HOST_ID } from "./session-catalog-adoption.js";
import {
  CLAUDE_SESSIONS_LIST_COMMAND,
  CLAUDE_TERMINAL_RESUME_COMMAND,
  ClaudeCatalogParamsError,
  listClaudeSessions,
  resolveNodeClaudeRecord,
} from "./session-catalog.js";

// Desktop sessions share the resumable projects store with CLI sessions.
export function isResumableClaudeSource(source: string | undefined): boolean {
  return source === "claude-cli" || source === "claude-desktop";
}

export function claudeNodeTerminalCapability(node: { connected?: boolean; commands?: string[] }): {
  canOpenTerminalClaude?: true;
} {
  return node.connected === true && node.commands?.includes(CLAUDE_TERMINAL_RESUME_COMMAND) === true
    ? { canOpenTerminalClaude: true }
    : {};
}

export function isLocalClaudeResumable(hostId: string, source: string | undefined): boolean {
  return hostId === CLAUDE_LOCAL_SESSION_HOST_ID && isResumableClaudeSource(source);
}

export function canOpenClaudeTerminalSession(
  host: { hostId: string; canOpenTerminalClaude?: boolean },
  source: string | undefined,
): boolean {
  return (
    isResumableClaudeSource(source) &&
    (host.hostId === CLAUDE_LOCAL_SESSION_HOST_ID || host.canOpenTerminalClaude === true)
  );
}

export async function openClaudeCatalogTerminal(params: {
  api: OpenClawPluginApi;
  hostId: string;
  threadId: string;
}): Promise<SessionCatalogTerminalPlan> {
  const title = `claude --resume ${params.threadId.slice(0, 8)}…`;
  if (params.hostId === CLAUDE_LOCAL_SESSION_HOST_ID) {
    const record = (await listClaudeSessions()).find(
      (candidate) => candidate.threadId === params.threadId,
    );
    if (!record || !isResumableClaudeSource(record.source)) {
      throw new ClaudeCatalogParamsError("Claude session is unavailable");
    }
    const source = await fs.stat(record.filePath).catch(() => undefined);
    if (!source?.isFile()) {
      throw new ClaudeCatalogParamsError("Claude session transcript is unavailable");
    }
    return {
      kind: "local",
      argv: ["claude", "--resume", params.threadId],
      ...(record.cwd ? { cwd: record.cwd } : {}),
      title,
    };
  }
  if (!params.hostId.startsWith("node:")) {
    throw new ClaudeCatalogParamsError("hostId is invalid");
  }
  const nodeId = params.hostId.slice("node:".length);
  const node = (await params.api.runtime.nodes.list()).nodes.find(
    (candidate) =>
      candidate.nodeId === nodeId &&
      candidate.connected === true &&
      candidate.commands?.includes(CLAUDE_SESSIONS_LIST_COMMAND) === true &&
      candidate.commands.includes(CLAUDE_TERMINAL_RESUME_COMMAND),
  );
  if (!node) {
    throw new ClaudeCatalogParamsError("paired-node Claude terminal is unavailable");
  }
  const record = await resolveNodeClaudeRecord({
    runtime: params.api.runtime,
    nodeId,
    threadId: params.threadId,
  });
  if (!isResumableClaudeSource(record.source)) {
    throw new ClaudeCatalogParamsError("Claude session cannot be resumed in a terminal");
  }
  return {
    kind: "node",
    nodeId,
    command: CLAUDE_TERMINAL_RESUME_COMMAND,
    paramsJSON: JSON.stringify({
      threadId: params.threadId,
      ...(record.cwd ? { cwd: record.cwd } : {}),
    }),
    ...(record.cwd ? { cwd: record.cwd } : {}),
    title,
  };
}
