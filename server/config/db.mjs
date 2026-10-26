import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// Connection pool - reused across the app instead of opening a new
// connection per request (much better performance under load)
// Connection pool configuration supporting both local and cloud hosted MySQL
const poolConfig = process.env.DATABASE_URL
  ? {
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false },
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'cptruck_db',
      port: Number(process.env.DB_PORT) || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    };

const pool = mysql.createPool(poolConfig);

// Quick test to confirm connection works when the server starts
export const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    const [[dbResult]] = await connection.query('SELECT DATABASE() as current_db;');
    console.log(`✅ MySQL connected successfully to database: [${dbResult?.current_db || process.env.DB_NAME}]`);
    connection.release();
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    process.exit(1);
  }
};

export { pool };
