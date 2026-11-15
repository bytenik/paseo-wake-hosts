import type { NetworkInterfaceInfo } from "node:os";
import { createSocket } from "node:dgram";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { httpTransport, wolTransport } from "../shared/contracts.ts";
import { inspect, magicPacket, sendHttp, sendMagicPacket, wolNetwork } from "./transports.ts";
import { createExecutor } from "./executor.ts";

const cleanup: (() => Promise<void>)[] = [];
async function serve(handler: (request: IncomingMessage, response: ServerResponse) => void) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server address");
  cleanup.push(
    () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  return `http://127.0.0.1:${address.port}`;
}
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});

describe("HTTP wake transport", () => {
  it("delivers a Home Assistant style POST with headers and a JSON entity body", async () => {
    const received: { method?: string; authorization?: string; body: string }[] = [];
    const origin = await serve(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      received.push({ method: request.method, authorization: request.headers.authorization, body });
      response.writeHead(202).end();
    });
    await sendHttp(
      httpTransport.parse({
        type: "http",
        url: `${origin}/api/services/script/turn_on`,
        headers: { Authorization: "Bearer test-value", "Content-Type": "application/json" },
        body: '{"entity_id":"script.wake_pc"}',
      }),
    );
    expect(received).toEqual([
      {
        method: "POST",
        authorization: "Bearer test-value",
        body: '{"entity_id":"script.wake_pc"}',
      },
    ]);
  });
  it("checks TCP reachability without firing the wake endpoint", async () => {
    let actions = 0;
    const origin = await serve((_request, response) => {
      actions++;
      response.end();
    });
    expect(await inspect({ type: "http", origin })).toEqual({
      eligible: true,
      reason: "Wake service TCP port is reachable",
    });
    expect(actions).toBe(0);
  });
  it("does not follow a redirect or disclose the wake token to its destination", async () => {
    let forwarded = 0;
    const other = await serve((_request, response) => {
      forwarded++;
      response.end();
    });
    const origin = await serve((_request, response) =>
      response.writeHead(302, { Location: other }).end(),
    );
    await expect(
      sendHttp(
        httpTransport.parse({
          type: "http",
          url: origin,
          headers: { Authorization: "Bearer private" },
        }),
      ),
    ).rejects.toThrow("HTTP 302");
    expect(forwarded).toBe(0);
  });
  it("does not echo endpoint URLs, credentials, or response bodies in errors", async () => {
    const origin = await serve((_request, response) =>
      response.writeHead(403).end("private-response-secret"),
    );
    await expect(
      sendHttp(
        httpTransport.parse({
          type: "http",
          url: `${origin}/private-webhook`,
          headers: { Authorization: "Bearer private" },
        }),
      ),
    ).rejects.toThrow(/^Wake service returned HTTP 403$/);
  });
  it("ends a stalled request without automatically replaying it", async () => {
    let actions = 0;
    const origin = await serve(() => {
      actions++;
    });
    await expect(
      sendHttp(httpTransport.parse({ type: "http", url: origin, timeoutMs: 100 })),
    ).rejects.toThrow("delivery is uncertain");
    expect(actions).toBe(1);
  });
  it("coalesces simultaneous clients waking the same target on one executor", async () => {
    let actions = 0;
    const origin = await serve((_request, response) => {
      actions++;
      response.end();
    });
    const executor = createExecutor();
    const request = httpTransport.parse({ type: "http", url: origin });
    const first = executor.execute("pc", request);
    const second = executor.execute("pc", request);
    expect(second).toBe(first);
    await expect(first).resolves.toEqual({ accepted: true });
    expect(actions).toBe(1);
  });
});

describe("Wake-on-LAN", () => {
  it("sends the magic packet through a real UDP socket", async () => {
    const receiver = createSocket("udp4");
    await new Promise<void>((resolve) => receiver.bind(0, "127.0.0.1", resolve));
    const received = new Promise<Buffer>((resolve, reject) => {
      receiver.once("message", resolve);
      receiver.once("error", reject);
    });
    try {
      await sendMagicPacket({
        mac: "01:23:45:67:89:AB",
        bindAddress: "127.0.0.1",
        address: "127.0.0.1",
        port: receiver.address().port,
      });
      expect((await received).toString("hex")).toBe("ff".repeat(6) + "0123456789ab".repeat(16));
    } finally {
      receiver.close();
    }
  });
  it("encodes a standard 102-byte magic packet", () => {
    const packet = magicPacket("01:23:45:67:89:AB");
    expect(packet.toString("hex")).toBe("ff".repeat(6) + "0123456789ab".repeat(16));
    expect(magicPacket("01-23-45-67-89-AB")).toEqual(packet);
  });
  it("selects the matching LAN interface and computes its directed broadcast", () => {
    const entry: NetworkInterfaceInfo = {
      address: "192.168.3.12",
      family: "IPv4",
      internal: false,
      netmask: "255.255.255.0",
      mac: "01:23:45:67:89:ab",
      cidr: "192.168.3.12/24",
    };
    expect(wolNetwork("192.168.3.0/24", { lan: [entry] })).toEqual({
      bindAddress: "192.168.3.12",
      broadcastAddress: "192.168.3.255",
    });
    expect(wolNetwork("192.168.4.0/24", { lan: [entry] })).toEqual({
      bindAddress: null,
      broadcastAddress: "192.168.4.255",
    });
  });
  it("rejects malformed addresses instead of broadcasting to a different network", () => {
    expect(() => wolNetwork("999.168.1.0/24")).toThrow("valid IPv4");
    expect(() =>
      wolTransport.parse({ type: "wol", mac: "bad", network: "192.168.1.0/24" }),
    ).toThrow();
  });
});
