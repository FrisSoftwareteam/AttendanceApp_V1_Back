import { Router } from "express";
import { AttendanceModel } from "../models/Attendance";
import { cloudinary, isCloudinaryReady } from "../config/cloudinary";
import tzLookup from "tz-lookup";
import { reverseGeocode } from "../utils/geocode";
import { getCutoffTime } from "../utils/settings";
import { getStatusForTime } from "../utils/time";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth";
import { isMongoDuplicate } from "../utils/mongo";
import { toAttendanceRecord } from "../utils/serializers";

const router = Router();

router.get("/today", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const dateKey = todayKey();
    const query: Record<string, unknown> = { dateKey };
    if (req.user?.role !== "admin") {
      query.userId = req.user?._id;
    }

    const items = await AttendanceModel.find(query).sort({ capturedAt: 1 });
    res.json({ date: dateKey, items: items.map(toAttendanceRecord) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:date", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const dateKey = req.params.date;
    const items = await AttendanceModel.find({ dateKey }).sort({ capturedAt: 1 });
    res.json({ date: dateKey, items: items.map(toAttendanceRecord) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const dateKey = todayKey();
    const { locationLabel, photoUrl, photoPublicId, latitude, longitude, accuracy } = req.body ?? {};

    if (!locationLabel) {
      res.status(400).json({ error: "Missing location label" });
      return;
    }

    const lat = toNumber(latitude);
    const lng = toNumber(longitude);
    const acc = toNumber(accuracy);
    if (lat === null || lng === null) {
      res.status(400).json({ error: "Location coordinates are required" });
      return;
    }
    const timezone = lat !== null && lng !== null ? safeTimezone(lat, lng) : undefined;
    const fallbackLabel =
      typeof locationLabel === "string" && locationLabel.trim().length > 0
        ? locationLabel.trim()
        : formatGpsLabel(lat, lng, acc);
    const geocoded = await reverseGeocode(lat, lng);
    const resolvedLabel = geocoded?.label ?? fallbackLabel;

    const capturedAt = new Date();
    const cutoffTime = await getCutoffTime();
    const status = timezone ? getStatusForTime(capturedAt, timezone, cutoffTime) : "on-time";

    const record = await AttendanceModel.create({
      dateKey,
      userId: req.user!._id,
      userName: req.user!.name,
      capturedAt,
      status,
      locationLabel: resolvedLabel,
      photoUrl: photoUrl ? String(photoUrl) : undefined,
      photoPublicId: photoPublicId ? String(photoPublicId) : undefined,
      latitude: lat ?? undefined,
      longitude: lng ?? undefined,
      accuracy: acc ?? undefined,
      timezone
    });

    res.status(201).json(toAttendanceRecord(record));
  } catch (err) {
    if (isMongoDuplicate(err)) {
      res.status(409).json({ error: "User already checked in today" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const id = req.params.id;
    const record = await AttendanceModel.findById(id);

    if (!record) {
      res.status(404).json({ error: "Record not found" });
      return;
    }

    if (req.user?.role !== "admin" && record.userId.toString() !== req.user?._id.toString()) {
      res.status(403).json({ error: "Not allowed" });
      return;
    }

    if (record.photoPublicId) {
      if (!isCloudinaryReady()) {
        res.status(503).json({ error: "Cloudinary not configured" });
        return;
      }

      const result = await cloudinary.uploader.destroy(record.photoPublicId, {
        resource_type: "image"
      });

      if (result.result !== "ok" && result.result !== "not found") {
        res.status(502).json({ error: "Failed to delete image from Cloudinary" });
        return;
      }
    }

    await record.deleteOne();
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return null;
  }
  return num;
}

function safeTimezone(latitude: number, longitude: number) {
  try {
    return tzLookup(latitude, longitude);
  } catch {
    return undefined;
  }
}

function formatGpsLabel(latitude: number, longitude: number, accuracy: number | null) {
  const lat = latitude.toFixed(5);
  const lng = longitude.toFixed(5);
  const acc = accuracy !== null ? ` (+/-${Math.round(accuracy)}m)` : "";
  return `GPS ${lat}, ${lng}${acc}`;
}
