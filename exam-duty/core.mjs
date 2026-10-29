const SLOTS = { A: { start: "09:00", end: "10:30", label: "9:00\u201310:30 AM" }, B: { start: "11:30", end: "13:00", label: "11:30 AM\u20131:00 PM" }, C: { start: "14:00", end: "15:30", label: "2:00\u20133:30 PM" } };
function dutyStart(d) {
  return (/* @__PURE__ */ new Date(`${d.date}T${SLOTS[d.slot].start}:00+06:00`)).getTime();
}
function timeBefore(d, mins) {
  return new Date(dutyStart(d) - mins * 6e4).toLocaleTimeString("en-US", { timeZone: "Asia/Dhaka", hour: "numeric", minute: "2-digit" });
}
function isFuture(d, now = Date.now()) {
  return dutyStart(d) > now;
}
function validateExchange(all, sender, recipient, give, back, now = Date.now()) {
  if (sender === recipient) throw new Error("Choose another teacher.");
  if (!give.length || give.length > 3 || back.length > 3 || (/* @__PURE__ */ new Set([...give, ...back])).size !== give.length + back.length) throw new Error("Select one to three distinct duties.");
  const out = give.map((id) => all.find((d) => d.id === id)), ret = back.map((id) => all.find((d) => d.id === id));
  if (out.some((d) => !d || d.teacherId !== sender) || ret.some((d) => !d || d.teacherId !== recipient)) throw new Error("The selected duties have changed. Refresh the roster.");
  if ([...out, ...ret].some((d) => d.needsReview)) throw new Error("A selected duty needs committee review.");
  if ([...out, ...ret].some((d) => !isFuture(d, now))) throw new Error("Started or past duties cannot be swapped.");
  for (const [ds, target] of [[out, recipient], [ret, sender]]) {
    if (ds.some((d) => all.some((x) => x.teacherId === target && x.date === d.date && x.slot === d.slot))) throw new Error("This exchange would clash with an existing duty.");
  }
  return [...out, ...ret].map((d) => ({ id: d.id, teacherId: d.teacherId, version: d.version || 0 }));
}
const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
function stamp(ms) {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z/, "Z");
}
function fold(line) {
  let lines = [], part = "", bytes = 0;
  for (const c of line) {
    const n = new TextEncoder().encode(c).length;
    if (bytes + n > 74) {
      lines.push(part);
      part = " ";
      bytes = 1;
    }
    part += c;
    bytes += n;
  }
  return [...lines, part].join("\r\n");
}
function calendar(teacher, duties) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DIU CSE//Exam Duty//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:DIU Exam Duty - " + esc(teacher.initial || teacher.name), "X-WR-TIMEZONE:Asia/Dhaka"];
  for (const d of duties.filter((d2) => !d2.needsReview)) {
    const start = dutyStart(d), end = (/* @__PURE__ */ new Date(`${d.date}T${SLOTS[d.slot].end}:00+06:00`)).getTime();
    lines.push("BEGIN:VEVENT", "UID:" + d.id + "@diu-exam-duty", "DTSTAMP:" + stamp(Date.now()), "DTSTART:" + stamp(start), "DTEND:" + stamp(end), "SEQUENCE:" + (d.version || 0), "SUMMARY:" + esc(`Exam duty \xB7 Slot ${d.slot} \xB7 ${d.building === "ANX1" ? "ANX1 (Annex 1)" : "Knowledge Tower"}`), "LOCATION:" + esc(d.building === "ANX1" ? "ANX1 (Annex 1) Building - confirm control room" : "Knowledge Tower - Exam Control KT-204, Level 2"), "DESCRIPTION:" + esc(`${teacher.name}. Arrive at Exam Control by ${timeBefore(d, 30)} (30 minutes early). Confirm exact exam room at control. Regenerate this calendar after an accepted swap.`), "BEGIN:VALARM", "TRIGGER:-PT40M", "ACTION:DISPLAY", "DESCRIPTION:Exam duty in 40 minutes. Report to Exam Control 30 minutes before start.", "END:VALARM", "END:VEVENT");
  }
  return [...lines, "END:VCALENDAR"].map(fold).join("\r\n") + "\r\n";
}
export {
  SLOTS,
  calendar,
  dutyStart,
  isFuture,
  timeBefore,
  validateExchange
};
