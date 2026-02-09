import { Schema, model, InferSchemaType } from "mongoose";

const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true }
  },
  { timestamps: true }
);

type SettingDocument = InferSchemaType<typeof settingSchema> & {
  _id: string;
  createdAt?: Date;
  updatedAt?: Date;
};

const SettingModel = model("Setting", settingSchema);

export { SettingModel, settingSchema };
export type { SettingDocument };
