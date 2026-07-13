import { expectDefined } from "@openclaw/normalization-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/types.openclaw.js";
import { createEmptyPluginRegistry } from "../../plugins/registry-empty.js";
import { resetPluginRuntimeStateForTest, setActivePluginRegistry } from "../../plugins/runtime.js";
import type { SessionCatalogProvider } from "../../plugins/session-catalog.js";
import { createTerminalLaunchPolicy } from "../terminal/launch.js";
import { terminalHandlers } from "./terminal.js";

function makeOpts(
  params: unknown,
  terminalConfig: { enabled?: boolean } | undefined,
  terminalPolicyConfig?: OpenClawConfig,
  nodeRegistry: { get: (nodeId: string) => unknown } = { get: () => undefined },
) {
  const sessions = {
    open: vi.fn(async () => ({
      ok: true as const,
      sessionId: "terminal-1",
      agentId: "main",
      shell: "/bin/zsh",
      cwd: "/work",
    })),
    write: vi.fn(() => true),
    resize: vi.fn(() => true),
    close: vi.fn(() => true),
    snapshot: vi.fn(() => "10%\r100%"),
  };
  const runtimeConfig = { gateway: { terminal: terminalConfig } } as OpenClawConfig;
  const policy = createTerminalLaunchPolicy(runtimeConfig);
  if (terminalPolicyConfig) {
    policy.prepareConfig(terminalPolicyConfig, { restartPending: true });
  }
  const respond = vi.fn();
  const context = {
    getRuntimeConfig: () => runtimeConfig,
    resolveTerminalLaunchPolicy: (agentId?: string) => policy.resolve(agentId),
    isTerminalEnabled: () => policy.isEnabled(),
    terminalSessions: sessions,
    nodeRegistry,
    logGateway: { info: vi.fn() },
  } as unknown as Parameters<(typeof terminalHandlers)["terminal.input"]>[0]["context"];
  const opts = {
    params: params as Record<string, unknown>,
    respond,
    context,
    client: { connId: "conn-1", connect: {} },
  } as unknown as Parameters<(typeof terminalHandlers)["terminal.input"]>[0];
  return { opts, sessions, respond };
}

function installCatalog(provider: SessionCatalogProvider) {
  const registry = createEmptyPluginRegistry();
  registry.sessionCatalogs.push({ pluginId: "test", provider, source: "test" });
  setActivePluginRegistry(registry);
}

afterEach(() => {
  resetPluginRuntimeStateForTest();
});

describe("terminal gateway policy", () => {
  it("rejects catalog opens for missing providers", async () => {
    const { opts, sessions, respond } = makeOpts(
      {
        cols: 80,
        rows: 24,
        catalog: { catalogId: "missing", hostId: "gateway:local", threadId: "thread" },
      },
      { enabled: true },
    );
    await expectDefined(terminalHandlers["terminal.open"], "terminal.open")(opts);
    expect(sessions.open).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(false, undefined, expect.any(Object));
  });

  it("opens a provider-built local resume plan and returns its title", async () => {
    const openTerminal = vi.fn(async () => ({
      kind: "local" as const,
      argv: ["codex", "resume", "thread"],
      title: "codex resume thread",
    }));
    installCatalog({
      id: "codex",
      label: "Codex",
      list: async () => [],
      read: async (request) => ({
        hostId: request.hostId,
        threadId: request.threadId,
        items: [],
      }),
      openTerminal,
    });
    const { opts, sessions, respond } = makeOpts(
      {
        cols: 80,
        rows: 24,
        catalog: { catalogId: "codex", hostId: "gateway:local", threadId: "thread" },
      },
      { enabled: true },
    );
    await expectDefined(terminalHandlers["terminal.open"], "terminal.open")(opts);

    expect(openTerminal).toHaveBeenCalledWith({ hostId: "gateway:local", threadId: "thread" });
    expect(sessions.open).toHaveBeenCalledWith(
      expect.objectContaining({
        shell: expect.any(String),
        args: ["-il", "-c", "'codex' 'resume' 'thread'"],
      }),
    );
    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ sessionId: "terminal-1", title: "codex resume thread" }),
    );
  });

  it("rejects a node plan when its owner node is disconnected", async () => {
    installCatalog({
      id: "claude",
      label: "Claude",
      list: async () => [],
      read: async (request) => ({
        hostId: request.hostId,
        threadId: request.threadId,
        items: [],
      }),
      openTerminal: async () => ({
        kind: "node",
        nodeId: "node-1",
        command: "anthropic.claude.terminal.resume.v1",
        paramsJSON: JSON.stringify({ threadId: "thread" }),
      }),
    });
    const { opts, sessions, respond } = makeOpts(
      {
        cols: 80,
        rows: 24,
        catalog: { catalogId: "claude", hostId: "node:node-1", threadId: "thread" },
      },
      { enabled: true },
    );
    await expectDefined(terminalHandlers["terminal.open"], "terminal.open")(opts);
    expect(sessions.open).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(false, undefined, expect.any(Object));
  });

  it("rejects reopening after an accepted disable while restart is pending", async () => {
    const { opts, sessions, respond } = makeOpts(
      { cols: 80, rows: 24 },
      { enabled: true },
      { gateway: { terminal: { enabled: false } } },
    );

    await expectDefined(
      terminalHandlers["terminal.open"],
      'terminalHandlers["terminal.open"] test invariant',
    )(opts);

    expect(sessions.open).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(false, undefined, expect.any(Object));
  });

  it("rejects reopening after an accepted sandbox tightening", async () => {
    const { opts, sessions, respond } = makeOpts(
      { cols: 80, rows: 24 },
      { enabled: true },
      {
        gateway: { terminal: { enabled: true } },
        agents: { defaults: { sandbox: { mode: "all" } } },
      },
    );

    await expectDefined(
      terminalHandlers["terminal.open"],
      'terminalHandlers["terminal.open"] test invariant',
    )(opts);

    expect(sessions.open).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(false, undefined, expect.any(Object));
  });

  it("closes a live session and rejects input after disablement", async () => {
    const { opts, sessions, respond } = makeOpts(
      { sessionId: "s1", data: "ls\n" },
      { enabled: false },
    );

    await expectDefined(
      terminalHandlers["terminal.input"],
      'terminalHandlers["terminal.input"] test invariant',
    )(opts);

    expect(sessions.write).not.toHaveBeenCalled();
    expect(sessions.close).toHaveBeenCalledWith("conn-1", "s1");
    expect(respond).toHaveBeenCalledWith(true, { ok: false });
  });

  it("sanitizes terminal snapshots before returning plain text", async () => {
    const { opts, sessions, respond } = makeOpts({ sessionId: "s1" }, { enabled: true });
    const finals = Array.from({ length: 0x7e - 0x40 + 1 }, (_, offset) =>
      String.fromCharCode(0x40 + offset),
    );
    const sequences = ["\u001B[", "\u009B"]
      .flatMap((introducer) => finals.map((finalByte) => introducer + finalByte))
      .join("");
    sessions.snapshot.mockReturnValue(`before${sequences}after`);

    await expectDefined(
      terminalHandlers["terminal.text"],
      'terminalHandlers["terminal.text"] test invariant',
    )(opts);

    expect(respond).toHaveBeenCalledWith(true, { text: "beforeafter" });
  });
});
