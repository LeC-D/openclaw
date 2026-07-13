import { describe, expect, it, vi } from "vitest";
import { dispatchNodeInvokeInput, registerNodeInvokeInputHandler } from "./runtime.js";

function createTarget() {
  return {
    nextInputSeq: 0,
    pendingInput: [] as Array<{ payloadJSON: string; bytes: number }>,
    pendingInputBytes: 0,
  };
}

describe("node-host invoke input dispatch", () => {
  it("buffers frames before registration and flushes them in order", () => {
    const input = vi.fn();
    const target = createTarget();

    expect(dispatchNodeInvokeInput(target, 0, "first")).toBe(true);
    expect(dispatchNodeInvokeInput(target, 1, "second")).toBe(true);
    expect(input).not.toHaveBeenCalled();

    registerNodeInvokeInputHandler(target, input);
    expect(input.mock.calls).toEqual([["first"], ["second"]]);
  });

  it("drops duplicate sequence numbers", () => {
    const input = vi.fn();
    const target = createTarget();
    registerNodeInvokeInputHandler(target, input);

    expect(dispatchNodeInvokeInput(undefined, 0, "unknown")).toBe(false);
    expect(dispatchNodeInvokeInput(target, 0, "first")).toBe(true);
    expect(dispatchNodeInvokeInput(target, 0, "duplicate")).toBe(false);
    expect(dispatchNodeInvokeInput(target, 1, "second")).toBe(true);
    expect(input.mock.calls).toEqual([["first"], ["second"]]);
  });

  it("drops the oldest buffered frame on overflow and keeps accepting input", () => {
    const input = vi.fn();
    const target = createTarget();
    const chunk = "x".repeat(16 * 1024);

    for (let seq = 0; seq < 5; seq += 1) {
      expect(dispatchNodeInvokeInput(target, seq, `${seq}${chunk}`)).toBe(true);
    }
    registerNodeInvokeInputHandler(target, input);
    expect(input.mock.calls.map(([payload]) => String(payload).slice(0, 1))).toEqual([
      "2",
      "3",
      "4",
    ]);
    expect(dispatchNodeInvokeInput(target, 5, "continued")).toBe(true);
    expect(input).toHaveBeenLastCalledWith("continued");
  });

  it("tolerates sequence gaps", () => {
    const input = vi.fn();
    const target = createTarget();
    registerNodeInvokeInputHandler(target, input);

    expect(dispatchNodeInvokeInput(target, 2, "gap")).toBe(true);
    expect(dispatchNodeInvokeInput(target, 3, "next")).toBe(true);
    expect(input.mock.calls).toEqual([["gap"], ["next"]]);
  });
});
