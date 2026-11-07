import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import {
  MEETING_LENGTH,
  agendaHtml,
  agendaSubject,
  agendaText,
  buildAgenda,
} from "../../../lib/agenda";
import { buildAgendaPdf } from "../../../lib/pdf";
import { cleanAgendaInput } from "../../../lib/validate";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function codeMatches(given) {
  const expected = process.env.HR_ACCESS_CODE || "";
  if (!expected || typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function fail(status, error) {
  return Response.json({ error }, { status });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Invalid request.");
  }

  const { code, to } = body || {};

  if (!codeMatches(code)) return fail(401, "Wrong HR access code.");
  if (typeof to !== "string" || !EMAIL_RE.test(to.trim())) {
    return fail(400, "Enter a valid participants' email address.");
  }

  const input = cleanAgendaInput(body.meeting, body.items);
  if (input.error) return fail(400, input.error);
  const { meeting: clean, items: cleanItems } = input;

  const { total } = buildAgenda(clean, cleanItems);
  if (total !== MEETING_LENGTH) {
    return fail(
      400,
      total > MEETING_LENGTH
        ? `The agenda is ${total - MEETING_LENGTH} minutes over 1 hour. Adjust the minutes.`
        : `The agenda is ${MEETING_LENGTH - total} minutes short of 1 hour. Adjust the minutes.`
    );
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!url || !key || !resendKey || !from) {
    return fail(500, "Server is not configured. Check the environment variables.");
  }

  // Build the PDF first: if it fails, nothing is saved or sent.
  let pdfBase64;
  try {
    pdfBase64 = Buffer.from(await buildAgendaPdf(clean, cleanItems)).toString("base64");
  } catch {
    return fail(500, "Could not build the PDF.");
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const recipient = to.trim();

  // 1. Save before sending, so nothing is lost if email fails.
  const { data: saved, error: saveError } = await supabase
    .from("meeting_agendas")
    .insert({
      meeting_date: clean.date,
      start_time: clean.start,
      venue: clean.venue,
      recap: clean.recap,
      items: cleanItems,
      recipient,
      status: "pending",
    })
    .select("id")
    .single();

  if (saveError) return fail(500, "Could not save the agenda: " + saveError.message);

  // 2. Send the email with the PDF attached.
  let sendError = "";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: agendaSubject(clean),
        html: agendaHtml(clean, cleanItems),
        text: agendaText(clean, cleanItems),
        attachments: [
          { filename: `Tiffany-Weekly-Agenda-${clean.date}.pdf`, content: pdfBase64 },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      sendError = detail.message || `Email provider returned ${res.status}.`;
    }
  } catch (e) {
    sendError = "Could not reach the email provider.";
  }

  // 3. Record the outcome.
  await supabase
    .from("meeting_agendas")
    .update(
      sendError
        ? { status: "failed", error: sendError }
        : { status: "sent", sent_at: new Date().toISOString() }
    )
    .eq("id", saved.id);

  if (sendError) return fail(502, "The agenda was saved but the email failed: " + sendError);
  return Response.json({ ok: true, id: saved.id });
}
