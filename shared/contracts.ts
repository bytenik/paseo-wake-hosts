import { defineRpc, defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

const httpUrl = z.url().refine((value) => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
}, "Use an HTTP(S) URL without embedded credentials");
const headers = z.record(z.string(), z.string().max(8192));
export const httpTransport = z.object({
  type: z.literal("http"),
  url: httpUrl,
  method: z.enum(["POST", "PUT", "PATCH"]).default("POST"),
  headers: headers.default({}),
  headerEnv: headers.default({}),
  body: z.string().max(65536).optional(),
  timeoutMs: z.number().int().min(100).max(30000).default(10000),
});
export const wolTransport = z.object({
  type: z.literal("wol"),
  mac: z.string().regex(/^(?:[\da-f]{2}:){5}[\da-f]{2}$|^(?:[\da-f]{2}-){5}[\da-f]{2}$/i),
  network: z
    .string()
    .regex(/^(?:\d{1,3}\.){3}\d{1,3}\/(?:[1-9]|[12]\d|30)$/)
    .refine(
      (value) =>
        value
          .split("/")[0]
          .split(".")
          .every((octet) => Number(octet) <= 255),
      "Use a valid IPv4 subnet",
    ),
  port: z.number().int().min(1).max(65535).default(9),
});
export const transport = z.discriminatedUnion("type", [httpTransport, wolTransport]);
export const target = z.object({
  serverId: z.string().min(1),
  name: z.string().min(1),
  timeoutMs: z.number().int().min(1000).max(300000).default(120000),
  transport,
});
export type WakeTransport = z.infer<typeof transport>;
export type WakeTarget = z.infer<typeof target>;
export const preferences = defineSettings({
  id: "wake",
  scope: "host",
  version: 1,
  schema: z
    .object({ executorTrusted: z.boolean().default(false), targets: z.array(target).default([]) })
    .refine(
      ({ targets }) => new Set(targets.map((entry) => entry.serverId)).size === targets.length,
      "Configure each Paseo host only once",
    ),
});
const summary = target.omit({ transport: true });
export type TargetSummary = z.infer<typeof summary>;
export const listTargets = defineRpc({
  name: "targets.list",
  input: z.object({}),
  output: z.object({ executorTrusted: z.boolean(), targets: z.array(summary) }),
});
export const inspection = z.discriminatedUnion("type", [
  z.object({ type: z.literal("http"), origin: httpUrl }),
  z.object({ type: z.literal("wol"), network: wolTransport.shape.network }),
]);
export type Inspection = z.infer<typeof inspection>;
export const executeWake = defineRpc({
  name: "executor.wake",
  input: z.object({ targetServerId: z.string().min(1) }).strict(),
  output: z.object({ accepted: z.literal(true) }),
});
