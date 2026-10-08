const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('server/database/spendwise.db');
db.all('SELECT sql FROM sqlite_master WHERE type="table"', [], (err, rows) => {
  if (err) console.error(err);
  else {
    rows.forEach(r => console.log(r.sql));
    console.log('---');
    db.get('SELECT COUNT(*) as c FROM transactions', [], (e, r) => {
      console.log('transactions count:', r.c);
      db.all('SELECT * FROM transactions LIMIT 3', [], (e2, rows2) => {
        console.log('sample transactions:', JSON.stringify(rows2, null, 2));
        db.close();
      });
    });
  }
});
