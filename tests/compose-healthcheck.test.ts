import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";

// Der Healthcheck in docker-compose.yml entscheidet, ob Traefik den Container routet.
// Er muss den Port aus PORT nehmen (Deploy: 3099) und bei Verbindungsfehlern scheitern.
function healthcheckScript(): string {
  const compose = Bun.YAML.parse(
    readFileSync(join(import.meta.dir, "..", "docker-compose.yml"), "utf8"),
  ) as { services: Record<string, { healthcheck?: { test?: string[] } }> };
  const command = compose.services["mailbox-mcp"]?.healthcheck?.test ?? [];
  const script = command[command.indexOf("-e") + 1];
  if (!command.includes("-e") || !script) {
    throw new Error("Healthcheck-Skript (node -e …) in docker-compose.yml nicht gefunden");
  }
  return script;
}

async function runHealthcheck(port: number): Promise<number> {
  const proc = Bun.spawn([process.execPath, "-e", healthcheckScript()], {
    env: { ...process.env, PORT: String(port) },
    stdout: "ignore",
    stderr: "ignore",
  });
  return proc.exited;
}

async function withServer(status: number, run: (port: number) => Promise<void>): Promise<void> {
  const server = createServer((req, res) => {
    res.statusCode = req.url === "/health" ? status : 404;
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run((server.address() as AddressInfo).port);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

describe("docker-compose healthcheck", () => {
  test("is healthy when /health on PORT answers 200", async () => {
    await withServer(200, async (port) => {
      expect(await runHealthcheck(port)).toBe(0);
    });
  });

  test("is unhealthy when /health on PORT answers 503", async () => {
    await withServer(503, async (port) => {
      expect(await runHealthcheck(port)).not.toBe(0);
    });
  });

  test("is unhealthy when nothing listens on PORT", async () => {
    expect(await runHealthcheck(await freePort())).not.toBe(0);
  });
});
