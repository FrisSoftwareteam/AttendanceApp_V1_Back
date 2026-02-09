export type Role = "user" | "admin";

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
};

export type AttendanceRecord = {
  id: string;
  userId: string;
  userName: string;
  capturedAt: string;
  status: "on-time" | "late" | "missing";
  locationLabel: string;
  photoUrl?: string;
  photoPublicId?: string;
  flagComment?: string;
  flaggedAt?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  timezone?: string;
};
