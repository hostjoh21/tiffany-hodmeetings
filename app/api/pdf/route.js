import { buildAgendaPdf } from "../../../lib/pdf";
import { cleanAgendaInput } from "../../../lib/validate";

export const runtime = "nodejs";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const input = cleanAgendaInput(body && body.meeting, body && body.items);
  if (input.error) return Response.json({ error: input.error }, { status: 400 });

  try {
    const bytes = await buildAgendaPdf(input.meeting, input.items);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Tiffany-Weekly-Agenda-${input.meeting.date}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return Response.json({ error: "Could not build the PDF." }, { status: 500 });
  }
}
