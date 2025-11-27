import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// Create connection pool for better performance
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test connection on startup
export async function testConnection() {
  try {
    // Log connection config (without password) for debugging
    console.log("Database config:", {
      host: process.env.DB_HOST || "(not set)",
      port: process.env.DB_PORT || "(not set)",
      user: process.env.DB_USER || "(not set)",
      database: process.env.DB_NAME || "(not set)",
      passwordSet: !!process.env.DB_PASSWORD,
    });

    const connection = await pool.getConnection();
    console.log("Database connected successfully");
    connection.release();
    return true;
  } catch (error) {
    console.log("Database connection failed:", error.message);
    console.log("Stack:", error.stack);
    return false;
  }
}

export default pool;
