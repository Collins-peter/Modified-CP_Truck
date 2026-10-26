import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const runSeed = async () => {
  console.log('🌱 Starting CP Truck database initialization...');

  const connectionConfig = process.env.DATABASE_URL
    ? {
        uri: process.env.DATABASE_URL,
        multipleStatements: true,
        ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false },
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        port: Number(process.env.DB_PORT) || 3306,
        multipleStatements: true,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      };

  const connection = await mysql.createConnection(connectionConfig);

  try {
    let sqlPath = path.resolve(__dirname, '../../database.sql');
    if (!fs.existsSync(sqlPath)) {
      sqlPath = path.resolve(__dirname, '../database.sql');
    }
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`database.sql not found at ${sqlPath}`);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Executing database.sql...');
    await connection.query(sql);
    console.log('✅ Database created and seeded successfully with demo accounts!');
    console.log('--------------------------------------------------');
    console.log('Admin:    admin@cptruck.com    / admin123');
    console.log('Riders:   rider1@cptruck.com   / password123');
    console.log('          rider2@cptruck.com   / password123');
    console.log('Customer: customer@cptruck.com / password123');
    console.log('--------------------------------------------------');
  } catch (err) {
    console.error('❌ Database seeding error:', err.message);
  } finally {
    await connection.end();
  }
};

runSeed();
