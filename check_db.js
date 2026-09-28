
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Rabtoise', 'billing.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT * FROM template_settings", [], (err, rows) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
