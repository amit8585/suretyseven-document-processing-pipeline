const { getPool } = require('../db/pool');
const { getRedisConnection } = require('../services/queueService');

async function health(req, res) {
  let database = 'ok';
  let redis = 'ok';

  try {
    await getPool().query('SELECT 1');
  } catch (error) {
    database = 'error';
  }

  try {
    const pong = await getRedisConnection().ping();
    if (pong !== 'PONG') {
      redis = 'error';
    }
  } catch (error) {
    redis = 'error';
  }

  const healthy = database === 'ok' && redis === 'ok';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    checks: { database, redis },
  });
}

module.exports = { health };
