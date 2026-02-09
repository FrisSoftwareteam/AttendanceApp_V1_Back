import type { AttendanceRecord, PublicUser, Role } from "../types";
import type { AttendanceDocument } from "../models/Attendance";
import type { UserDocument } from "../models/User";

export function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role as Role,
    createdAt: user.createdAt?.toISOString?.() ?? new Date().toISOString()
  };
}

export function toAttendanceRecord(record: AttendanceDocument): AttendanceRecord {
  return {
    id: record._id.toString(),
    userId: record.userId.toString(),
    userName: record.userName,
    capturedAt: record.capturedAt.toISOString(),
    status: record.status,
    locationLabel: record.locationLabel,
    photoUrl: record.photoUrl ?? undefined,
    photoPublicId: record.photoPublicId ?? undefined,
    flagComment: record.flagComment ?? undefined,
    flaggedAt: record.flaggedAt?.toISOString?.() ?? undefined,
    latitude: record.latitude ?? undefined,
    longitude: record.longitude ?? undefined,
    accuracy: record.accuracy ?? undefined,
    timezone: record.timezone ?? undefined
  };
}
