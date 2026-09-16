const fs = require('fs');
const path = require('path');
const { query, closePool } = require('./pool');
const { logger } = require('../config/logger');

async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDir = path.resolve(__dirname, '../../migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const applied = await query('SELECT filename FROM schema_migrations');
  const appliedSet = new Set(applied.rows.map((row) => row.filename));

  for (const file of files) {
    if (appliedSet.has(file)) {
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    logger.info('Applying migration', { filename: file });
    await query(sql);
    await query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
  }
}

if (require.main === module) {
  migrate()
    .then(async () => {
      logger.info('Migrations complete');
      await closePool();
    })
    .catch(async (error) => {
      logger.error('Migration failed', { failureReason: error.message });
      await closePool();
      process.exit(1);
    });
}

module.exports = { migrate };
