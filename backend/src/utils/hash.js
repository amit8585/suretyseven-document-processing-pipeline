const crypto = require('crypto');
const fs = require('fs/promises');

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function sha256File(filePath) {
  const buffer = await fs.readFile(filePath);
  return sha256Buffer(buffer);
}

module.exports = { sha256Buffer, sha256File };
