import { initDB, run } from '../server/db.js';

async function main() {
  await initDB();
  run('DROP TABLE IF EXISTS stakes');
  console.log("Stakes table dropped successfully.");
}

main();
