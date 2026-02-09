import { Router } from "express";
import * as XLSX from "xlsx";
import { requireAuth, requireRole } from "../middleware/auth";
import { AttendanceModel } from "../models/Attendance";
import { UserModel } from "../models/User";
import { toAttendanceRecord } from "../utils/serializers";
import { getCutoffTime, setCutoffTime } from "../utils/settings";
import { cutoffSchema } from "../validation/settings";
import { flagSchema } from "../validation/attendance";
import { getStatusForRecord } from "../utils/time";
import { formatZodErrors } from "../validation/auth";

const router = Router();

router.get("/settings", requireAuth, requireRole("admin"), async (_req, res) => {
  try {
    const cutoffTime = await getCutoffTime();
    res.json({ cutoffTime });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/settings", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = cutoffSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const { fieldErrors, formError } = formatZodErrors(parsed.error);
    res.status(400).json({ error: formError ?? "Invalid input", fieldErrors });
    return;
  }

  try {
    const cutoffTime = await setCutoffTime(parsed.data.cutoffTime);
    res.json({ cutoffTime });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/attendance", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const dateKey = typeof req.query.date === "string" ? req.query.date : todayKey();
    const cutoffTime = await getCutoffTime();
    const [items, users] = await Promise.all([
      AttendanceModel.find({ dateKey }).sort({ capturedAt: 1 }),
      UserModel.find({ role: "user" }).sort({ name: 1 })
    ]);

    res.json({
      date: dateKey,
      cutoffTime,
      items: items.map(toAttendanceRecord),
      users: users.map((user) => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/attendance/:id/flag", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = flagSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const { fieldErrors, formError } = formatZodErrors(parsed.error);
    res.status(400).json({ error: formError ?? "Invalid input", fieldErrors });
    return;
  }

  try {
    const record = await AttendanceModel.findById(req.params.id);
    if (!record) {
      res.status(404).json({ error: "Record not found" });
      return;
    }

    const comment = parsed.data.comment?.trim();
    if (comment && comment.length > 0) {
      record.flagComment = comment;
      record.flaggedAt = new Date();
    } else {
      record.flagComment = undefined;
      record.flaggedAt = undefined;
    }

    await record.save();
    res.json(toAttendanceRecord(record));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/users", requireAuth, requireRole("admin"), async (_req, res) => {
  try {
    const users = await UserModel.find({ role: "user" }).sort({ name: 1 });
    res.json({
      users: users.map((user) => ({ id: user._id.toString(), name: user.name, email: user.email }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/users/:id/attendance", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const userId = req.params.id;
    const month = typeof req.query.month === "string" ? req.query.month : currentMonthKey();
    if (!/^[0-9]{4}-[0-9]{2}$/.test(month)) {
      res.status(400).json({ error: "Invalid month format" });
      return;
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const cutoffTime = await getCutoffTime();
    const items = await AttendanceModel.find({
      userId,
      dateKey: { $regex: `^${month}` }
    }).sort({ capturedAt: 1 });

    const enriched = items.map((item) => {
      const record = toAttendanceRecord(item);
      const status = getStatusForRecord(item, cutoffTime);
      return { ...record, status };
    });

    const onTime = enriched.filter((item) => item.status === "on-time").length;
    const late = enriched.filter((item) => item.status === "late").length;
    const total = enriched.length;
    const punctualityRate = total === 0 ? 0 : Math.round((onTime / total) * 100);

    res.json({
      user: { id: user._id.toString(), name: user.name, email: user.email },
      month,
      cutoffTime,
      stats: { onTime, late, total, punctualityRate },
      items: enriched
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/export", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const range = resolveExportRange(req.query);
    if (!range) {
      res.status(400).json({ error: "Invalid date range. Use YYYY-MM-DD." });
      return;
    }
    const { start, end } = range;

    const cutoffTime = await getCutoffTime();
    const [items, users] = await Promise.all([
      AttendanceModel.find({ dateKey: { $gte: start, $lte: end } }).sort({ dateKey: 1, userName: 1 }),
      UserModel.find({ role: "user" }).sort({ name: 1 })
    ]);

    const attendanceByKey = new Map(items.map((item) => [`${item.userId}-${item.dateKey}`, item]));
    const headers = ["Date", "Time", "Employee", "Status", "Location", "Flag Comment"];
    const dateKeys = getDateKeysBetween(start, end);

    const rows: Array<Record<string, string>> = [];
    for (const dateKey of dateKeys) {
      for (const user of users) {
        const item = attendanceByKey.get(`${user._id}-${dateKey}`);
        if (!item) {
          rows.push({
            Date: dateKey,
            Time: "",
            Employee: user.name,
            Status: "Missing",
            Location: "",
            "Flag Comment": ""
          });
          continue;
        }
        rows.push({
          Date: dateKey,
          Time: formatTimeForTimeZone(item.capturedAt, item.timezone),
          Employee: item.userName,
          Status: statusLabel(getStatusForRecord(item, cutoffTime)),
          Location: item.locationLabel,
          "Flag Comment": item.flagComment ?? ""
        });
      }
    }

    const buffer = buildWorkbook(rows, headers);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="attendance-${start}-to-${end}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/users/:id/export", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const userId = req.params.id;
    const month = typeof req.query.month === "string" ? req.query.month : currentMonthKey();
    if (!/^[0-9]{4}-[0-9]{2}$/.test(month)) {
      res.status(400).json({ error: "Invalid month format" });
      return;
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const items = await AttendanceModel.find({
      userId,
      dateKey: { $regex: `^${month}` }
    }).sort({ capturedAt: 1 });
    const cutoffTime = await getCutoffTime();

    const headers = ["Date", "Time", "Employee", "Status", "Location", "Flag Comment"];
    const rows = items.map((item) => ({
      Date: formatDateForTimeZone(item.capturedAt, item.timezone),
      Time: formatTimeForTimeZone(item.capturedAt, item.timezone),
      Employee: item.userName,
      Status: statusLabel(getStatusForRecord(item, cutoffTime)),
      Location: item.locationLabel,
      "Flag Comment": item.flagComment ?? ""
    }));

    const buffer = buildWorkbook(rows, headers);
    const safeName = toSafeFilename(user.name);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attendance-${safeName}-${month}.xlsx"`
    );
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function resolveExportRange(query: Record<string, unknown>) {
  const dateParam = typeof query.date === "string" ? query.date : undefined;
  let start = typeof query.start === "string" ? query.start : undefined;
  let end = typeof query.end === "string" ? query.end : undefined;

  if (!start && !end && dateParam) {
    start = dateParam;
    end = dateParam;
  }

  if (start && !end) {
    end = start;
  }
  if (end && !start) {
    start = end;
  }

  if (!start || !end || !isValidDateKey(start) || !isValidDateKey(end)) {
    return null;
  }

  if (start > end) {
    return null;
  }

  return { start, end };
}

function isValidDateKey(value: string) {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value);
}

function getDateKeysBetween(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return [];
  }
  const results: string[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    results.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return results;
}

function statusLabel(status: string) {
  switch (status) {
    case "late":
      return "Late";
    case "missing":
      return "Missing";
    case "on-time":
    default:
      return "On time";
  }
}

function formatDateForTimeZone(date: Date, timeZone?: string) {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone
    });
    return formatter.format(date);
  } catch {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return formatter.format(date);
  }
}

function formatTimeForTimeZone(date: Date, timeZone?: string) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone
    });
    return formatter.format(date);
  } catch {
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    return formatter.format(date);
  }
}

function buildWorkbook(rows: Array<Record<string, string>>, headers: string[]) {
  const worksheet =
    rows.length === 0
      ? XLSX.utils.aoa_to_sheet([headers])
      : XLSX.utils.json_to_sheet(rows, { header: headers, skipHeader: false });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function toSafeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "user";
}
