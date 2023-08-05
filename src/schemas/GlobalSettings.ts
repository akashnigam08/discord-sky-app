import mongoose from 'mongoose';

const globalSettingsSchema = new mongoose.Schema({
  globalGifsPerHour: {
    type: Number,
    default: 0,
    required: true,
  }
});

const GlobalSettings = mongoose.model('GlobalSettings', globalSettingsSchema);

export const createDefaultGlobalSettings = async () => {
  try {
    const count = await GlobalSettings.countDocuments({});
    if (count === 0) {
      console.log('GlobalSettings collection is empty, creating default settings...');
      const defaultSettings = new GlobalSettings();
      defaultSettings.save();
    }
  } catch(err: any) {
    console.log('Error checking if GlobalSettings collection is empty:', err);
    process.exit(1);
  }
}

export default GlobalSettings;
