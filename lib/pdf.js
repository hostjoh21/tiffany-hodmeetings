// Premium agenda report (A4 PDF) in the company's brand colours, built with pdf-lib.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { buildAgenda, fmtDate, fmtTime, toMinutes } from "./agenda";
import { LOGO_BASE64, LOGO_WIDTH, LOGO_HEIGHT } from "./logoData";

// Colours sampled from the logo.
const C = {
  orange: rgb(0.91, 0.388, 0.165), // #E8632A
  deep: rgb(0.878, 0.322, 0.024), // #E05206
  green: rgb(0.592, 0.749, 0.235), // #97BF3C
  yellow: rgb(0.91, 0.784, 0.102), // #E8C81A
  ink: rgb(0.078, 0.129, 0.169),
  muted: rgb(0.4, 0.43, 0.46),
  line: rgb(0.89, 0.865, 0.835),
  tint: rgb(0.993, 0.962, 0.932),
  white: rgb(1, 1, 1),
};

const W = 595.28;
const H = 841.89;
const M = 44;
const CW = W - 2 * M;
const FOOTER_H = 46;

// Standard PDF fonts only cover Latin-1 and a few punctuation marks.
function clean(s) {
  return String(s ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/≈/g, "~")
    .replace(/→/g, "->")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/[✓✔✅]/g, "")
    .replace(/\t/g, "  ")
    .replace(/\r/g, "")
    .replace(/[^\n\x20-\x7E -ÿ•€]/g, "?");
}

// Shrink a single line to fit its column, then truncate as a last resort.
function fit(s, font, size, maxW, minSize = 8) {
  let t = clean(s).replace(/\s+/g, " ").trim() || "-";
  let sz = size;
  while (sz > minSize && font.widthOfTextAtSize(t, sz) > maxW) sz -= 0.5;
  if (font.widthOfTextAtSize(t, sz) > maxW) {
    while (t.length > 1 && font.widthOfTextAtSize(t + "...", sz) > maxW) t = t.slice(0, -1);
    t += "...";
  }
  return { t, sz };
}

function wrap(text, font, size, maxW) {
  const out = [];
  for (const para of clean(text).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = "";
    for (let w of words) {
      while (font.widthOfTextAtSize(w, size) > maxW) {
        let cut = w.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxW) cut--;
        if (line) {
          out.push(line);
          line = "";
        }
        out.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      const t = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(t, size) <= maxW) line = t;
      else {
        out.push(line);
        line = w;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

// Six equal bars mirroring the arcs of the logo: orange, green, yellow, yellow, green, orange.
function stripe(page, y, h) {
  const cols = [C.orange, C.green, C.yellow, C.yellow, C.green, C.orange];
  const w = W / cols.length;
  cols.forEach((c, i) => page.drawRectangle({ x: i * w, y, width: w + 0.5, height: h, color: c }));
}

export async function buildAgendaPdf(meeting, items) {
  const { rows, total, endTime } = buildAgenda(meeting, items);

  const pdf = await PDFDocument.create();
  pdf.setTitle("Weekly Operations Meeting Agenda - " + fmtDate(meeting.date));
  pdf.setAuthor("Tiffany Diamond Hotels Limited");
  pdf.setSubject("Weekly Operations Meeting");
  pdf.setCreator("Tiffany Weekly Agenda");

  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const script = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const scriptBold = await pdf.embedFont(StandardFonts.TimesRomanBoldItalic);
  const logo = await pdf.embedPng(Buffer.from(LOGO_BASE64, "base64"));

  const text = (page, s, x, y, font, size, color) =>
    page.drawText(clean(s), { x, y, font, size, color });
  const textRight = (page, s, xRight, y, font, size, color) => {
    const t = clean(s);
    page.drawText(t, { x: xRight - font.widthOfTextAtSize(t, size), y, font, size, color });
  };

  let page;
  let y;

  function tableHeader() {
    page.drawRectangle({ x: M, y: y - 24, width: CW, height: 24, color: C.orange });
    text(page, "TIME", M + 12, y - 16, bold, 8, C.white);
    text(page, "AGENDA ITEM", M + 104, y - 16, bold, 8, C.white);
    text(page, "RESPONSIBLE AND KEY POINTS", M + 268, y - 16, bold, 8, C.white);
    y -= 24;
  }

  function firstPage() {
    page = pdf.addPage([W, H]);
    stripe(page, H - 9, 9);

    const lw = 168;
    const lh = (lw * LOGO_HEIGHT) / LOGO_WIDTH;
    page.drawImage(logo, { x: M - 6, y: H - 30 - lh, width: lw, height: lh });

    textRight(page, "MEETING AGENDA", W - M, H - 52, bold, 9, C.deep);
    textRight(page, "Weekly Operations", W - M, H - 78, scriptBold, 27, C.ink);
    textRight(page, "Meeting", W - M, H - 106, scriptBold, 27, C.orange);
    textRight(page, "Every Tuesday and Friday", W - M, H - 124, reg, 9, C.muted);

    y = H - 30 - lh - 18;

    // Meeting facts.
    const boxH = 84;
    page.drawRectangle({ x: M, y: y - boxH, width: CW, height: boxH, color: C.tint, borderColor: C.line, borderWidth: 0.8 });
    const cells = [
      [M + 16, y - 22, "DATE", fmtDate(meeting.date)],
      [M + 262, y - 22, "TIME", fmtTime(toMinutes(meeting.start)) + " - " + endTime],
      [M + 372, y - 22, "VENUE", meeting.venue || "-"],
      [M + 16, y - 56, "CHAIRPERSON", "General Manager"],
      [M + 262, y - 56, "SECRETARY", "Human Resource Manager"],
    ];
    cells.forEach(([x, cy, label, value]) => {
      text(page, label, x, cy, bold, 7.5, C.deep);
      const maxW = label === "VENUE" ? M + CW - 12 - x : label === "DATE" ? 236 : label === "TIME" ? 104 : 200;
      const v = fit(value, bold, 11, maxW);
      text(page, v.t, x, cy - 15, bold, v.sz, C.ink);
    });
    y -= boxH + 26;

    text(page, "Order of Business", M, y - 14, scriptBold, 18, C.ink);
    page.drawRectangle({ x: M, y: y - 24, width: 34, height: 2.5, color: C.orange });
    page.drawRectangle({ x: M + 34, y: y - 24, width: 20, height: 2.5, color: C.green });
    page.drawRectangle({ x: M + 54, y: y - 24, width: 20, height: 2.5, color: C.yellow });
    y -= 36;
    tableHeader();
  }

  function nextPage() {
    page = pdf.addPage([W, H]);
    stripe(page, H - 9, 9);
    text(page, "Tiffany Diamond Hotels Limited", M, H - 36, scriptBold, 13, C.orange);
    textRight(page, "Weekly Operations Meeting  |  " + fmtDate(meeting.date), W - M, H - 35, reg, 8.5, C.muted);
    page.drawLine({ start: { x: M, y: H - 46 }, end: { x: W - M, y: H - 46 }, thickness: 0.8, color: C.line });
    y = H - 62;
  }

  function ensure(height, repeatHeader) {
    if (y - height < FOOTER_H + 16) {
      nextPage();
      if (repeatHeader) tableHeader();
    }
  }

  firstPage();

  // Agenda rows.
  rows.forEach((r, i) => {
    const colItem = 150 - 16;
    const colResp = CW - 268 - 12;
    const itemLines = wrap(r.title, bold, 10, colItem);
    const ownerLines = wrap(r.owner, bold, 10, colResp);
    const roleLines = r.named ? wrap(r.role, reg, 8, colResp) : [];
    const ptsLines = r.points ? wrap(r.points, reg, 9.5, colResp) : [];

    const itemH = itemLines.length * 13;
    const respH =
      ownerLines.length * 13 + (roleLines.length ? roleLines.length * 10 + 1 : 0) + (ptsLines.length ? 4 + ptsLines.length * 12.5 : 0);
    const rowH = Math.max(itemH, respH, 14) + 20;

    ensure(rowH, true);

    if (i % 2 === 0) page.drawRectangle({ x: M, y: y - rowH, width: CW, height: rowH, color: C.tint });
    page.drawLine({ start: { x: M, y: y - rowH }, end: { x: M + CW, y: y - rowH }, thickness: 0.6, color: C.line });

    text(page, r.time, M + 12, y - 10 - 9, bold, 10, C.deep);
    text(page, r.mins + " min", M + 12, y - 10 - 21, reg, 8, C.muted);

    let ty = y - 10 - 9;
    itemLines.forEach((l, k) => text(page, l, M + 104, ty - k * 13, bold, 10, C.ink));

    ty = y - 10 - 9;
    ownerLines.forEach((l) => {
      text(page, l, M + 268, ty, bold, 10, C.ink);
      ty -= 13;
    });
    ty += 13 - 10;
    roleLines.forEach((l) => {
      text(page, l, M + 268, ty, reg, 8, C.muted);
      ty -= 10;
    });
    if (ptsLines.length) {
      ty -= 4 - (roleLines.length ? 0 : 1);
      ptsLines.forEach((l) => {
        text(page, l, M + 268, ty, reg, 9.5, C.ink);
        ty -= 12.5;
      });
    }
    y -= rowH;
  });

  // Total line.
  ensure(40, false);
  y -= 16;
  textRight(page, "Total " + total + " minutes  |  Closes at " + endTime, W - M, y - 2, bold, 9.5, C.ink);
  y -= 30;

  // Action points table.
  const actRow = 26;
  ensure(30 + 22 + actRow * 5 + 90, false);
  text(page, "Action Points", M, y - 14, scriptBold, 18, C.ink);
  page.drawRectangle({ x: M, y: y - 24, width: 34, height: 2.5, color: C.orange });
  page.drawRectangle({ x: M + 34, y: y - 24, width: 20, height: 2.5, color: C.green });
  page.drawRectangle({ x: M + 54, y: y - 24, width: 20, height: 2.5, color: C.yellow });
  y -= 36;
  page.drawRectangle({ x: M, y: y - 22, width: CW, height: 22, color: C.tint, borderColor: C.line, borderWidth: 0.8 });
  text(page, "ACTION", M + 12, y - 15, bold, 8, C.deep);
  text(page, "OWNER", M + 330, y - 15, bold, 8, C.deep);
  text(page, "DUE DATE", M + 430, y - 15, bold, 8, C.deep);
  y -= 22;
  for (let i = 0; i < 5; i++) {
    page.drawLine({ start: { x: M, y: y - actRow }, end: { x: M + CW, y: y - actRow }, thickness: 0.6, color: C.line });
    y -= actRow;
  }
  page.drawLine({ start: { x: M + 318, y: y + actRow * 5 }, end: { x: M + 318, y: y }, thickness: 0.6, color: C.line });
  page.drawLine({ start: { x: M + 418, y: y + actRow * 5 }, end: { x: M + 418, y: y }, thickness: 0.6, color: C.line });

  // Sign-off.
  y -= 52;
  const sx1 = M;
  const sx2 = M + CW / 2 + 16;
  const sw = CW / 2 - 16;
  page.drawLine({ start: { x: sx1, y }, end: { x: sx1 + sw, y }, thickness: 0.8, color: C.ink });
  page.drawLine({ start: { x: sx2, y }, end: { x: sx2 + sw, y }, thickness: 0.8, color: C.ink });
  text(page, "General Manager (Chairperson)", sx1, y - 13, bold, 9, C.ink);
  text(page, "Human Resource Manager (Secretary)", sx2, y - 13, bold, 9, C.ink);
  text(page, "Signature and date", sx1, y - 25, reg, 8, C.muted);
  text(page, "Signature and date", sx2, y - 25, reg, 8, C.muted);

  // Footer on every page.
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    stripe(p, 30, 3);
    text(p, "Tiffany Diamond Hotels Limited", M, 14, scriptBold, 10, C.orange);
    text(p, "The Top and Best in Tanzania", M + scriptBold.widthOfTextAtSize("Tiffany Diamond Hotels Limited", 10) + 12, 14, script, 10, C.muted);
    textRight(p, "Page " + (i + 1) + " of " + pages.length, W - M, 15, reg, 8, C.muted);
  });

  return pdf.save();
}
