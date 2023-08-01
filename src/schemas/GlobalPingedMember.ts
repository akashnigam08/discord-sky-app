import mongoose from 'mongoose';

const globalPingedMemberSchema = new mongoose.Schema({
  memberId: Number,
  guildId: Number,
});

const GlobalPingedMember = mongoose.model('GlobalPingedMember', globalPingedMemberSchema);

export default GlobalPingedMember;