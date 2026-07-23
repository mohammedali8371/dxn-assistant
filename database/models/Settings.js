/**
 * نموذج الإعدادات
 */

import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  description: { type: String, default: '' },
}, { timestamps: true });

settingsSchema.statics.getSetting = async function (key, defaultValue = null) {
  const setting = await this.findOne({ key });
  return setting ? setting.value : defaultValue;
};

settingsSchema.statics.setSetting = async function (key, value, description = '') {
  return await this.findOneAndUpdate(
    { key },
    { $set: { value, description } },
    { upsert: true, new: true }
  );
};

const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;
