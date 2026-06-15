import { initDB, getAll } from '../server/db.js';

async function main() {
  await initDB();
  const users = getAll('SELECT id, telegram_id, first_name, username, balance FROM users');
  console.log("ALL USERS:", users);
}

main();
