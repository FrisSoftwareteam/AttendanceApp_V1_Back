import { Schema, model, Types, InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], required: true },
    resetTokenHash: { type: String },
    resetTokenExpiresAt: { type: Date }
  },
  { timestamps: true }
);

type UserDocument = InferSchemaType<typeof userSchema> & {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

const UserModel = model("User", userSchema);

export { UserModel, userSchema };
export type { UserDocument };
