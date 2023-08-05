import mongoose from 'mongoose';

const randomGifPingSchema = new mongoose.Schema({
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

const RandomGifPing = mongoose.model('RandomGifPing', randomGifPingSchema);

export default RandomGifPing;