"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_ITEMS,
  DEFAULT_PARTICIPANTS,
  buildAgenda,
  fmtDate,
  fmtTime,
  listedParticipants,
  nextMeetingDate,
  toMinutes,
} from "../lib/agenda";

const DRAFT_KEY = "tiffany-agenda-draft-v2";

const blankItems = () => DEFAULT_ITEMS.map((d) => ({ name: "", pts: "", mins: d.mins }));

export default function AgendaForm({ defaultEmail }) {
  const [meeting, setMeeting] = useState({
    date: "",
    start: "09:00",
    venue: "Boardroom",
    recap: "",
  });
  const [items, setItems] = useState(blankItems);
  const [people, setPeople] = useState(() => DEFAULT_PARTICIPANTS.map((p) => ({ ...p })));
  const [email, setEmail] = useState(defaultEmail);
  const [code, setCode] = useState("");
  const [state, setState] = useState({ kind: "idle", text: "" });
  const [pdf, setPdf] = useState({ kind: "idle", text: "" });

  // Restore draft (never the access code) and pick the next Tuesday/Friday.
  useEffect(() => {
    let draft = null;
    try {
      draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    } catch (e) {}
    if (draft && draft.items && draft.items.length === DEFAULT_ITEMS.length) {
      setMeeting({ ...draft.meeting, date: draft.meeting.date || nextMeetingDate() });
      setItems(draft.items);
      if (Array.isArray(draft.people) && draft.people.length) setPeople(draft.people);
      if (draft.email) setEmail(draft.email);
    } else {
      setMeeting((m) => ({ ...m, date: nextMeetingDate() }));
    }
  }, []);

  useEffect(() => {
    if (!meeting.date) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ meeting, items, people, email }));
    } catch (e) {}
  }, [meeting, items, people, email]);

  const agenda = useMemo(() => buildAgenda(meeting, items), [meeting, items]);

  const setItem = (i, patch) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const setPerson = (i, patch) =>
    setPeople((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const addPerson = () => setPeople((prev) => [...prev, { name: "", title: "", present: true }]);
  const removePerson = (i) => setPeople((prev) => prev.filter((_, idx) => idx !== i));
  const listed = listedParticipants(people);
  const presentCount = listed.filter((p) => p.present).length;

  async function downloadPdf() {
    setPdf({ kind: "busy", text: "Preparing PDF…" });
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting, items, participants: people }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not build the PDF.");
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `Tiffany-Weekly-Agenda-${meeting.date}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 4000);
      setPdf({ kind: "ok", text: "PDF downloaded." });
    } catch (err) {
      setPdf({ kind: "err", text: err.message });
    }
  }

  async function submit(e) {
    e.preventDefault();
    setState({ kind: "busy", text: "Sending…" });
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, to: email, meeting, items, participants: people }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setState({ kind: "ok", text: "Agenda sent to " + email + " and saved." });
    } catch (err) {
      setState({ kind: "err", text: err.message });
    }
  }


  return (
    <div className="wrap">
      <div className="grid">
        <section className="stack" aria-label="HR form">
          <div className="panel">
            <h2>1. Meeting details</h2>
            <div className="stack">
              <div className="row3">
                <div>
                  <label className="lab" htmlFor="date">Date</label>
                  <input id="date" type="date" value={meeting.date}
                    onChange={(e) => setMeeting({ ...meeting, date: e.target.value })} />
                </div>
                <div>
                  <label className="lab" htmlFor="start">Start time</label>
                  <input id="start" type="time" value={meeting.start}
                    onChange={(e) => setMeeting({ ...meeting, start: e.target.value })} />
                </div>
                <div>
                  <label className="lab" htmlFor="venue">Venue</label>
                  <input id="venue" type="text" value={meeting.venue}
                    onChange={(e) => setMeeting({ ...meeting, venue: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="lab" htmlFor="recap">Recap of the previous meeting (GM)</label>
                <textarea id="recap" value={meeting.recap}
                  placeholder="Example: three open action points from Friday's meeting"
                  onChange={(e) => setMeeting({ ...meeting, recap: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="panel">
            <h2>2. Meeting participants</h2>
            <p className="hint" style={{ margin: "-4px 0 12px" }}>
              Enter the name of each person who attended. Titles are filled in and can be edited. Untick
              Present for someone who did not attend. Rows without a name are left out of the report.
            </p>
            <div className="people">
              {people.map((p, i) => (
                <div className="person" key={i}>
                  <label className="chk" htmlFor={"pp" + i}>
                    <input id={"pp" + i} type="checkbox" checked={p.present}
                      onChange={(e) => setPerson(i, { present: e.target.checked })} />
                    <span>Present</span>
                  </label>
                  <div>
                    <label className="lab" htmlFor={"pn" + i}>Name</label>
                    <input id={"pn" + i} type="text" value={p.name} placeholder="Full name"
                      onChange={(e) => setPerson(i, { name: e.target.value })} />
                  </div>
                  <div>
                    <label className="lab" htmlFor={"pt" + i}>Title</label>
                    <input id={"pt" + i} type="text" value={p.title} placeholder="Job title"
                      onChange={(e) => setPerson(i, { title: e.target.value })} />
                  </div>
                  <button type="button" className="ghost" aria-label={"Remove row " + (i + 1)}
                    onClick={() => removePerson(i)}>Remove</button>
                </div>
              ))}
            </div>
            <div className="total">
              <span>Present: <b>{presentCount}</b> of <b>{listed.length}</b> listed</span>
              <button type="button" className="ghost" onClick={addPerson}>Add participant</button>
            </div>
          </div>

          <div className="panel">
            <h2>3. Agenda items</h2>
            <p className="hint" style={{ margin: "-4px 0 12px" }}>
              Open an item to enter the presenter&apos;s name and key points. Minutes can be changed.
            </p>
            <div className="stack">
              {DEFAULT_ITEMS.map((d, i) => {
                const slot = agenda.rows[i];
                const filled = items[i].name.trim() || items[i].pts.trim();
                return (
                  <details className="item" key={d.key}>
                    <summary>
                      <span className="t">
                        {d.title}
                        <span className="role">{d.role}</span>
                      </span>
                      <span>
                        {filled ? <span className="filled">✓ </span> : null}
                        <span className="chip">{slot.mins} min</span>
                      </span>
                    </summary>
                    <div className="fields">
                      <div>
                        <label className="lab" htmlFor={"n" + i}>Name of presenter</label>
                        <input id={"n" + i} type="text" placeholder={d.role} value={items[i].name}
                          onChange={(e) => setItem(i, { name: e.target.value })} />
                      </div>
                      <div>
                        <label className="lab" htmlFor={"m" + i}>Minutes</label>
                        <input id={"m" + i} type="number" min="1" max="600" value={items[i].mins}
                          onChange={(e) => setItem(i, { mins: e.target.value })} />
                      </div>
                      <div className="full">
                        <label className="lab" htmlFor={"h" + i}>
                          Key points{i === 0 ? " (added to the recap above)" : ""}
                        </label>
                        <textarea id={"h" + i} value={items[i].pts}
                          placeholder="Main points to be presented"
                          onChange={(e) => setItem(i, { pts: e.target.value })} />
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
            <div className="total">
              <span>Total time: <b>{agenda.total}</b> min</span>
              <span>Ends at <b>{agenda.endTime}</b></span>
            </div>
          </div>
        </section>

        <section aria-label="Agenda">
          <div className="panel sheet">
            <h3>Meeting Agenda</h3>
            <div className="head">
              <span>Date: <b>{fmtDate(meeting.date)}</b></span>
              <span>Time: <b>{fmtTime(toMinutes(meeting.start))} - {agenda.endTime}</b></span>
              <span>Venue: <b>{meeting.venue || "-"}</b></span>
            </div>
            {listed.length ? (
              <>
                <h4 className="sec">Meeting Participants <span>Present {presentCount} of {listed.length}</span></h4>
                <div className="tw">
                  <table className="ptable">
                    <thead>
                      <tr><th>No.</th><th>Name</th><th>Title</th><th>Attendance</th></tr>
                    </thead>
                    <tbody>
                      {listed.map((p, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td className="who">{p.name}</td>
                          <td>{p.title}</td>
                          <td className={p.present ? "good" : ""}><b>{p.present ? "Present" : "Absent"}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
            <h4 className="sec">Order of Business</h4>
            <div className="tw">
              <table>
                <thead>
                  <tr><th>Time</th><th>Agenda item</th><th>Responsible and key points</th></tr>
                </thead>
                <tbody>
                  {agenda.rows.map((r) => (
                    <tr key={r.title}>
                      <td className="time">{r.time}</td>
                      <td>{r.title}</td>
                      <td>
                        <span className="who">{r.owner}</span>
                        {r.named ? <span className="rl">{r.role}</span> : null}
                        <p className={"pts" + (r.points ? "" : " empty")}>
                          {r.points || "Key points not entered yet"}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="actions">
              <button type="button" className="brand" onClick={downloadPdf} disabled={pdf.kind === "busy"}>
                {pdf.kind === "busy" ? "Preparing PDF…" : "Download PDF report"}
              </button>
            </div>
            {pdf.kind === "err" ? (
              <p role="status" className="hint bad">{pdf.text}</p>
            ) : null}
          </div>

          <form className="panel share" onSubmit={submit}>
            <h2>4. Send to all participants</h2>
            <p className="hint" style={{ margin: "-4px 0 12px" }}>
              The email includes the agenda and the PDF report as an attachment.
            </p>
            <div className="stack">
              <div>
                <label className="lab" htmlFor="email">Participants&apos; group email</label>
                <input id="email" type="email" required autoComplete="off" value={email}
                  placeholder="staff@yourdomain.com" onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="lab" htmlFor="code">HR access code</label>
                <input id="code" type="password" required autoComplete="off" value={code}
                  onChange={(e) => setCode(e.target.value)} />
              </div>
            </div>
            <div className="actions">
              <button type="submit" disabled={state.kind === "busy"}>
                {state.kind === "busy" ? "Sending…" : "Send agenda"}
              </button>
            </div>
            {state.text ? (
              <p role="status" className={"hint " + (state.kind === "ok" ? "good" : state.kind === "err" ? "bad" : "")}>
                {state.text}
              </p>
            ) : null}
          </form>
        </section>
      </div>
    </div>
  );
}
