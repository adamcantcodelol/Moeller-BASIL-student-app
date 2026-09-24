import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => new Headers(),
}));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { TEACHER_PASSWORD: "local-only" } }),
}));

describe("new teacher routes require the teacher cookie", () => {
  it("return 401 without a teacher session", async () => {
    const aiKey = await import("@/app/api/teacher/ai-key/route");
    const aiKeyTest = await import("@/app/api/teacher/ai-key/test/route");
    const exportRoute = await import("@/app/api/teacher/hypotheses/export/route");
    const projectRoute = await import("@/app/api/teacher/projects/[projectId]/hypothesis/route");
    const req = (method: string, body?: unknown) =>
      new Request("http://localhost/x", {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
    const responses = await Promise.all([
      aiKey.GET(),
      aiKey.PUT(req("PUT", { provider: "groq", apiKey: "gsk_1234567890123" })),
      aiKey.DELETE(req("DELETE")),
      aiKeyTest.POST(req("POST", { provider: "groq" })),
      exportRoute.GET(req("GET")),
      projectRoute.GET(req("GET"), { params: Promise.resolve({ projectId: "p" }) }),
    ]);
    for (const response of responses) expect(response.status).toBe(401);
  });
});
