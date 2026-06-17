const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('C:/Users/wdking/.local/share/mimocode/mimocode.db', { open: true, readOnly: true });

// Get raw message data for first user message in a recent session
const msgs = db.prepare(`
  SELECT m.id, substr(m.data, 1, 2000) as data_preview
  FROM message m
  WHERE m.session_id = 'ses_130c55022ffe13cxCjaX3CBX1P'
    AND json_extract(m.data, '$.role') = 'user'
  ORDER BY m.time_created
  LIMIT 3
`).all();

console.log('=== RAW USER MESSAGE DATA ===');
msgs.forEach(m => console.log(m.data_preview));

// Also get parts for those messages
console.log('\n=== PARTS FOR FIRST USER MESSAGE ===');
if (msgs.length > 0) {
  const parts = db.prepare(`
    SELECT id, substr(data, 1, 1000) as data_preview
    FROM part
    WHERE message_id = ?
    ORDER BY time_created
  `).all(msgs[0].id);
  parts.forEach(p => console.log(p.data_preview));
}

db.close();
