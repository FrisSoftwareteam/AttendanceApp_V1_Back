import { Schema, model, Types, InferSchemaType } from "mongoose";

const attendanceSchema = new Schema(
  {
    dateKey: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true },
    capturedAt: { type: Date, required: true },
    status: { type: String, enum: ["on-time", "late", "missing"], required: true },
    locationLabel: { type: String, required: true },
    photoUrl: { type: String },
    photoPublicId: { type: String },
    flagComment: { type: String },
    flaggedAt: { type: Date },
    latitude: { type: Number },
    longitude: { type: Number },
    accuracy: { type: Number },
    timezone: { type: String }
  },
  { timestamps: true }
);

attendanceSchema.index({ dateKey: 1, userId: 1 }, { unique: true });

type AttendanceDocument = InferSchemaType<typeof attendanceSchema> & {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

const AttendanceModel = model("Attendance", attendanceSchema);

export { AttendanceModel, attendanceSchema };
export type { AttendanceDocument };
