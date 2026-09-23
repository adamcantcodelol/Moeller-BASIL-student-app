export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    application: "Moeller BASIL Protein Platform",
    phase: 9,
  });
}
