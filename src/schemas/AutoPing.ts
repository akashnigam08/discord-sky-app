import mongoose from 'mongoose';

const autoPingSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true,
  },
  channelId: {
    type: String,
    required: true,
    index: true,
  },
  memberId: {
    type: String,
    required: true,
  },
  interval: {
    type: Number,
    required: true,
  },
  active: {
    type: Boolean,
    required: true,
  },
});

const AutoPing = mongoose.model('AutoPing', autoPingSchema);

export default AutoPing;