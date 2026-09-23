import { describe, expect, it, vi } from "vitest";
import { fetchJsonObject } from "@/adapters/fetch";
import { ScientificHttpError } from "@/adapters/errors";

describe("fetchJsonWithTimeout", () => {
  it("returns JSON objects", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ ok: true }));
    const body = await fetchJsonObject("https://example.test/data", {
      fetchImpl: fetchImpl as typeof fetch,
      label: "example",
    });
    expect(body).toEqual({ ok: true });
  });

  it("maps 404 without inventing a body", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 404 }));
    await expect(
      fetchJsonObject("https://example.test/missing", {
        fetchImpl: fetchImpl as typeof fetch,
        label: "example",
      }),
    ).rejects.toMatchObject({
      name: "ScientificHttpError",
      code: "NOT_FOUND",
    } satisfies Partial<ScientificHttpError>);
  });

  it("maps HTTP 204 to NOT_FOUND", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    await expect(
      fetchJsonObject("https://example.test/empty", {
        fetchImpl: fetchImpl as typeof fetch,
        label: "example",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", httpStatus: 204 });
  });

  it("maps timeouts", async () => {
    const fetchImpl = vi.fn(async () => {
      const error = new Error("aborted");
      error.name = "TimeoutError";
      throw error;
    });
    await expect(
      fetchJsonObject("https://example.test/slow", {
        fetchImpl: fetchImpl as typeof fetch,
        label: "example",
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});
