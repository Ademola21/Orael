import { initDB, run } from '../server/db.js';

async function main() {
  await initDB();
  const res = run('DELETE FROM users WHERE id >= 2');
  console.log("Deleted test users. Changes:", res.changes);
}

main();
