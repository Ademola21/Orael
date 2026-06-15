import { initDB, getDB } from './server/db.js';

async function test() {
  await initDB();
  const rawDb = getDB();
  console.log("DB initialized.");

  try {
    const stmt = rawDb.prepare("INSERT INTO users (telegram_id, referral_code) VALUES (11111, 'REF111')");
    stmt.step();
    stmt.free();
    
    // Test export
    console.log("Exporting...");
    rawDb.export();
    
    const lastIdRes = rawDb.exec("SELECT last_insert_rowid() AS id");
    console.log("after export lastIdRes:", lastIdRes[0].values);
  } catch (err) {
    console.error("Error during test:", err);
  }
}

test();
