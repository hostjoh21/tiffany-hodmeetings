// Shared agenda logic, used by the form (browser) and the send route (server).

export const DEFAULT_ITEMS = [
  { key: "open", title: "Opening & Recap", role: "GM", mins: 5 },
  { key: "hr", title: "HR Summary", role: "HR Manager", mins: 5 },
  { key: "sales", title: "Sales & Marketing Update", role: "Sales Executive(s)", mins: 6 },
  { key: "fo", title: "Front Office Update", role: "Front Office Manager", mins: 5 },
  { key: "hk", title: "Housekeeping Update", role: "Housekeeping Manager", mins: 4 },
  { key: "fb", title: "F&B Service Update", role: "F&B Manager", mins: 4 },
  { key: "chef", title: "Executive Chef Update", role: "Executive Chef", mins: 4 },
  { key: "cost", title: "Cost Control Report", role: "Cost Controller", mins: 4 },
  { key: "fin", title: "Finance & Accounts Update", role: "Accountant", mins: 5 },
  { key: "sec", title: "Security Update", role: "Security Officer", mins: 3 },
  { key: "ict", title: "ICT Update", role: "ICT Officer", mins: 3 },
  { key: "sum", title: "GM Summary & Action Points", role: "GM & HR", mins: 12 },
];

export const MEETING_LENGTH = 60;

export function toMinutes(hhmm) {
  const [h, m] = String(hhmm || "09:00").split(":");
  return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
}

export function fmtTime(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

export function fmtDate(iso) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Next Tuesday or Friday, today included.
export function nextMeetingDate(from = new Date()) {
  for (let i = 0; i < 8; i++) {
    const x = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    if (x.getDay() === 2 || x.getDay() === 5) {
      return [
        x.getFullYear(),
        String(x.getMonth() + 1).padStart(2, "0"),
        String(x.getDate()).padStart(2, "0"),
      ].join("-");
    }
  }
  return "";
}

// items: [{ name, pts, mins }] in the same order as DEFAULT_ITEMS
export function buildAgenda(meeting, items) {
  let cursor = toMinutes(meeting.start);
  const rows = DEFAULT_ITEMS.map((def, i) => {
    const it = items[i] || {};
    const mins = Math.max(1, parseInt(it.mins, 10) || def.mins);
    const from = cursor;
    cursor += mins;
    const points =
      i === 0 && (meeting.recap || "").trim() ? meeting.recap.trim() : (it.pts || "").trim();
    return {
      time: fmtTime(from) + " - " + fmtTime(cursor),
      title: def.title,
      role: def.role,
      owner: (it.name || "").trim() || def.role,
      named: Boolean((it.name || "").trim()),
      points,
      mins,
    };
  });
  const total = rows.reduce((a, r) => a + r.mins, 0);
  return { rows, total, endTime: fmtTime(cursor) };
}

export function agendaSubject(meeting) {
  return "Weekly Operations Meeting Agenda - " + fmtDate(meeting.date);
}

export function agendaText(meeting, items) {
  const { rows, endTime } = buildAgenda(meeting, items);
  let t =
    "TIFFANY DIAMOND HOTELS LTD\nWEEKLY OPERATIONS MEETING (1 HOUR)\n" +
    "Date: " + fmtDate(meeting.date) + "\n" +
    "Time: " + fmtTime(toMinutes(meeting.start)) + " - " + endTime + "\n" +
    "Venue: " + (meeting.venue || "-") + "\n" +
    "Chairperson: General Manager | Secretary: Human Resource Manager\n\n";
  rows.forEach((r) => {
    t += r.time + "  " + r.title + " (" + r.owner + ")\n";
    if (r.points) t += "   " + r.points.replace(/\n/g, "\n   ") + "\n";
  });
  return t;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

export function agendaHtml(meeting, items) {
  const { rows, endTime } = buildAgenda(meeting, items);
  const body = rows
    .map(
      (r) =>
        `<tr>
<td style="padding:10px;border-bottom:1px solid #d9e0e6;white-space:nowrap;font-weight:700;color:#E05206;vertical-align:top">${escapeHtml(r.time)}</td>
<td style="padding:10px;border-bottom:1px solid #d9e0e6;vertical-align:top">${escapeHtml(r.title)}</td>
<td style="padding:10px;border-bottom:1px solid #d9e0e6;vertical-align:top"><strong>${escapeHtml(r.owner)}</strong>${
          r.named ? `<br><span style="color:#5b6b78;font-size:12px">${escapeHtml(r.role)}</span>` : ""
        }${r.points ? `<div style="margin-top:4px;white-space:pre-wrap">${escapeHtml(r.points)}</div>` : ""}</td>
</tr>`
    )
    .join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#14212b;max-width:680px">
<p>Dear all,</p>
<p>Please find the agenda for the weekly operations meeting below. The PDF report is attached. Each head of department is kindly requested to prepare their update.</p>
<h2 style="margin:16px 0 4px;color:#E8632A">Tiffany Diamond Hotels Ltd</h2>
<p style="margin:0 0 12px;color:#5b6b78">
Date: <strong style="color:#14212b">${escapeHtml(fmtDate(meeting.date))}</strong> &nbsp;|&nbsp;
Time: <strong style="color:#14212b">${fmtTime(toMinutes(meeting.start))} - ${endTime}</strong> &nbsp;|&nbsp;
Venue: <strong style="color:#14212b">${escapeHtml(meeting.venue || "-")}</strong><br>
Chairperson: General Manager &nbsp;|&nbsp; Secretary: Human Resource Manager</p>
<table style="border-collapse:collapse;width:100%;font-size:14px">
<thead><tr>
<th align="left" style="padding:8px 10px;border-bottom:2px solid #E8632A;font-size:11px;text-transform:uppercase;color:#5b6b78">Time</th>
<th align="left" style="padding:8px 10px;border-bottom:2px solid #E8632A;font-size:11px;text-transform:uppercase;color:#5b6b78">Agenda item</th>
<th align="left" style="padding:8px 10px;border-bottom:2px solid #E8632A;font-size:11px;text-transform:uppercase;color:#5b6b78">Responsible and key points</th>
</tr></thead>
<tbody>${body}</tbody></table>
<p style="margin-top:16px">Regards,<br>Human Resource Manager<br>Tiffany Diamond Hotels Ltd</p>
</div>`;
}
