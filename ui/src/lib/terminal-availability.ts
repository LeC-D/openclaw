import type { ApplicationGatewaySnapshot } from "../app/context.ts";
import { hasOperatorAdminAccess } from "../app/operator-access.ts";
import { isGatewayMethodAdvertised } from "./gateway-methods.ts";

export function isTerminalAvailable(
  snapshot: ApplicationGatewaySnapshot,
  terminalEnabled: boolean,
): boolean {
  return Boolean(
    snapshot.connected &&
    terminalEnabled &&
    hasOperatorAdminAccess(snapshot.hello?.auth ?? null) &&
    isGatewayMethodAdvertised(snapshot, "terminal.open") === true,
  );
}
