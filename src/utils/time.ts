import type { AttendanceDocument } from "../models/Attendance";

export function parseCutoffTime(value: string) {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) {
    return null;
  }
  return {
    hour: Number(match[1]),
    minute: Number(match[2])
  };
}

export function getStatusForRecord(record: AttendanceDocument, cutoffTime: string) {
  return getStatusForTime(record.capturedAt, record.timezone ?? undefined, cutoffTime);
}

export function getLocalTimeParts(date: Date, timeZone?: string) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone
    });
    const parts = formatter.formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
    return { hour, minute };
  } catch {
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
    return { hour, minute };
  }
}

export function getStatusForTime(date: Date, timeZone: string | undefined, cutoffTime: string) {
  const cutoff = parseCutoffTime(cutoffTime) ?? { hour: 8, minute: 0 };
  const { hour, minute } = getLocalTimeParts(date, timeZone);
  if (hour < cutoff.hour) {
    return "on-time" as const;
  }
  if (hour === cutoff.hour && minute <= cutoff.minute) {
    return "on-time" as const;
  }
  return "late" as const;
}
