import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { connectDB } from './db';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import closetRoutes from './routes/closets';
import weatherRoutes from './routes/weather';
import notificationRoutes from './routes/notifications';
import { startNotificationService } from './services/notificationService';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/closets', closetRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  startNotificationService();
}).catch((err) => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});
