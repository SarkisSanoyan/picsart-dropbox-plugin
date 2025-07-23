import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectToDB } from './config/db';

const PORT = process.env.PORT || 8080;

connectToDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
  });
});
