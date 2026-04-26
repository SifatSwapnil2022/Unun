import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoute from "./routes/auth.js";

dotenv.config();

const app = express();
app.use(express.json());

app.use("/api/auth", authRoute);

const PORT = process.env.PORT || 5000;

// 1. connect DB first
connectDB();

// 2. then start server
app.listen(PORT, () => {
  console.log(`Auth server is running on port ${PORT}`);
});