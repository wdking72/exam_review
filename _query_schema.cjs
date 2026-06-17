const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('C:/Users/wdking/.local/share/mimocode/mimocode.db', { open: true, readOnly: true });

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('=== TABLES ===');
tables.forEach(t => console.log(t.name));

for (const t of ['session', 'message', 'part', 'task', 'task_event', 'actor_registry']) {
  try {
    const cols = db.prepare('PRAGMA table_info(' + t + ')').all();
    console.log('\n=== ' + t + ' columns ===');
    cols.forEach(c => console.log(c.name, c.type));
  } catch(e) { console.log('\n' + t + ': not found'); }
}
db.close();
