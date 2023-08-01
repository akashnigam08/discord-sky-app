import 'dotenv/config';
import mongoose from 'mongoose';

const dbUser = process.env.DATABASE_USERNAME;
const dbPassword = process.env.DATABASE_PASSWORD;
const dbName = process.env.DATABASE_NAME;
const connectionString = `mongodb+srv://${dbUser}:${dbPassword}@skyappdiscordbot.ckzmvgb.mongodb.net/${dbName}?retryWrites=true&w=majority`;

const connectDatabase = async () => {
  try {
    await mongoose.connect(connectionString);
    console.log("Connected to MongoDB successfully!");
  } catch (err: any) {
    console.error(err.message);
    // Exit process with failure
    process.exit(1);
  }
};

export default connectDatabase;