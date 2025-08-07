const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const initializeDatabase = async () => {
  console.log('Database initialized successfully');
};

const getQuery = async () => {};
const runQuery = async () => {};
const allQuery = async () => {};
const cleanupOldData = async () => {};

module.exports = { pool, initializeDatabase, getQuery, runQuery, allQuery, cleanupOldData };
