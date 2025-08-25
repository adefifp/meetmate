// src/lib/ics.ts
type MakeICSOpts = {
  title: string;
  start: Date;
  end: Date;
  description?: string;
  url?: string;
  uid?: string;
};

function toICSDateUTC(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function foldLine(line: string) {
  const chunks: string[] = [];
  let s = line;
  while (s.length > 75) {
    chunks.push(s.slice(0, 75));
    s = " " + s.slice(75);
  }
  chunks.push(s);
  return chunks.join("\r\n");
}

export function makeICS(opts: MakeICSOpts) {
  const { title, start, end, description, url, uid } = opts;

  const dtStamp = toICSDateUTC(new Date());
  const dtStart = toICSDateUTC(start);
  const dtEnd   = toICSDateUTC(end);
  const eventUid = uid ?? `${dtStart}-${dtEnd}@meetmate`;

  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//MeetMate//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${eventUid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    foldLine(`SUMMARY:${title}`),
    ...(description ? [foldLine(`DESCRIPTION:${description}`)] : []),
    ...(url ? [`URL:${url}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}
