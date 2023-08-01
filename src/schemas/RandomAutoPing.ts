import mongoose from 'mongoose';

const randomAutoPingSchema = new mongoose.Schema({
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
  interval: {
    type: Number,
    required: true,
  },
  active: {
    type: Boolean,
    required: true,
  },
});

const RandomAutoPing = mongoose.model('RandomAutoPing', randomAutoPingSchema);

export default RandomAutoPing;
