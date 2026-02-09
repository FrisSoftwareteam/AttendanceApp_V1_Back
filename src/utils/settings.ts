import { SettingModel } from "../models/Setting";

const CUTOFF_KEY = "cutoffTime";
const DEFAULT_CUTOFF = "08:00";

export async function getCutoffTime() {
  const setting = await SettingModel.findOne({ key: CUTOFF_KEY });
  return setting?.value ?? DEFAULT_CUTOFF;
}

export async function setCutoffTime(value: string) {
  const updated = await SettingModel.findOneAndUpdate(
    { key: CUTOFF_KEY },
    { value },
    { upsert: true, new: true }
  );
  return updated?.value ?? value;
}

export { DEFAULT_CUTOFF };
