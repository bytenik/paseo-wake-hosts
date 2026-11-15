import { createSocket } from "node:dgram";
import { createConnection, isIP } from "node:net";
import { networkInterfaces } from "node:os";
import type { NetworkInterfaceInfo } from "node:os";
import type { Inspection, WakeTransport } from "../shared/contracts.ts";

function ipv4(address: string): number {
  if (isIP(address) !== 4) throw new Error("Configure a valid IPv4 WOL network");
  return address.split(".").reduce((value, octet) => (value * 256 + Number(octet)) >>> 0, 0);
}

export function wolNetwork(
  cidr: string,
  interfaces: Record<string, NetworkInterfaceInfo[] | undefined> = networkInterfaces(),
) {
  const [address, prefixText] = cidr.split("/");
  const prefix = Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 1 || prefix > 30)
    throw new Error("Use an IPv4 WOL network with a prefix from 1 to 30");
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  const network = (ipv4(address) & mask) >>> 0;
  const broadcast = (network | ~mask) >>> 0;
  const broadcastAddress = [24, 16, 8, 0].map((shift) => (broadcast >>> shift) & 255).join(".");
  const addresses = Object.values(interfaces).flatMap((entries) => entries ?? []);
  const selected = addresses.find(
    (entry) =>
      entry.family === "IPv4" && !entry.internal && (ipv4(entry.address) & mask) >>> 0 === network,
  );
  return { broadcastAddress, bindAddress: selected?.address ?? null };
}

export function magicPacket(mac: string): Buffer {
  const compact = mac.replace(/[:-]/g, "");
  if (!/^[\da-f]{12}$/i.test(compact)) throw new Error("Invalid WOL MAC address");
  const address = Buffer.from(compact, "hex");
  const packet = Buffer.alloc(102, 255);
  for (let index = 0; index < 16; index++) address.copy(packet, 6 + index * 6);
  return packet;
}

export async function inspect(input: Inspection): Promise<{ eligible: boolean; reason: string }> {
  if (input.type === "wol") {
    const { bindAddress } = wolNetwork(input.network);
    return {
      eligible: bindAddress !== null,
      reason: bindAddress ? "LAN interface matches" : "No interface on the WOL network",
    };
  }
  const url = new URL(input.origin);
  const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
  return new Promise((resolve) => {
    const socket = createConnection({ host: url.hostname.replace(/^\[|\]$/g, ""), port });
    let finished = false;
    function finish(eligible: boolean) {
      if (finished) return;
      finished = true;
      socket.destroy();
      resolve({
        eligible,
        reason: eligible ? "Wake service TCP port is reachable" : "Wake service is unreachable",
      });
    }
    socket.setTimeout(2000, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

export async function sendHttp(
  input: Extract<WakeTransport, { type: "http" }>,
  signal?: AbortSignal,
): Promise<void> {
  const timeout = AbortSignal.timeout(input.timeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetch(input.url, {
      method: input.method,
      headers: input.headers,
      body: input.body,
      redirect: "manual",
      signal: requestSignal,
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error(`Wake service returned HTTP ${response.status}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Wake service returned HTTP "))
      throw error;
    throw new Error(
      "The HTTP wake request failed or timed out; delivery is uncertain. Check the host before retrying.",
    );
  }
}

export async function sendWol(input: Extract<WakeTransport, { type: "wol" }>): Promise<void> {
  const { bindAddress, broadcastAddress } = wolNetwork(input.network);
  if (!bindAddress) throw new Error("This daemon has no interface on the configured WOL network");
  await sendMagicPacket({
    mac: input.mac,
    bindAddress,
    address: broadcastAddress,
    port: input.port,
  });
}

export async function sendMagicPacket(input: {
  mac: string;
  bindAddress: string;
  address: string;
  port: number;
}): Promise<void> {
  const packet = magicPacket(input.mac);
  const socket = createSocket("udp4");
  await new Promise<void>((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => finish(new Error("WOL send timed out")), 2000);
    function finish(error?: Error) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      // A bind failure can close the socket before its error event is delivered.
      try {
        socket.close();
      } catch {}
      if (error) reject(new Error("Could not send the WOL packet"));
      else resolve();
    }
    socket.once("error", finish);
    socket.bind(0, input.bindAddress, () => {
      try {
        socket.setBroadcast(true);
        socket.send(packet, input.port, input.address, (error) => finish(error ?? undefined));
      } catch {
        finish(new Error("WOL send failed"));
      }
    });
  });
}
