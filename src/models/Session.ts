import { Schema, model, Types, InferSchemaType } from "mongoose";

const sessionSchema = new Schema(
  {
    token: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

type SessionDocument = InferSchemaType<typeof sessionSchema> & {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

const SessionModel = model("Session", sessionSchema);

export { SessionModel, sessionSchema };
export type { SessionDocument };
