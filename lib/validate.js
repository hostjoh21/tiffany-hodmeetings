import { DEFAULT_ITEMS } from "./agenda";

// Shared by the PDF and send routes. Returns { error } or { meeting, items }.
export function cleanAgendaInput(meeting, items) {
  if (
    !meeting ||
    !/^\d{4}-\d{2}-\d{2}$/.test(meeting.date || "") ||
    !/^\d{2}:\d{2}$/.test(meeting.start || "")
  ) {
    return { error: "Meeting date and start time are required." };
  }
  if (!Array.isArray(items) || items.length !== DEFAULT_ITEMS.length) {
    return { error: "The agenda items are incomplete." };
  }
  return {
    meeting: {
      date: meeting.date,
      start: meeting.start,
      venue: String(meeting.venue || "").slice(0, 200),
      recap: String(meeting.recap || "").slice(0, 4000),
    },
    items: items.map((it, i) => ({
      name: String((it && it.name) || "").slice(0, 120),
      pts: String((it && it.pts) || "").slice(0, 4000),
      mins: Math.min(60, Math.max(1, parseInt(it && it.mins, 10) || DEFAULT_ITEMS[i].mins)),
    })),
  };
}
