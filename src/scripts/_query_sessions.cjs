const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('C:/Users/wdking/.local/share/mimocode/mimocode.db', { open: true, readOnly: true });

// Get project info
const projects = db.prepare("SELECT * FROM project").all();
console.log('=== PROJECTS ===');
projects.forEach(p => console.log(JSON.stringify(p)));

// Get all sessions for this project, newest first
const projectId = '6ca3fa66-20e5-4e20-a678-64898f995340';
const sessions = db.prepare("SELECT id, slug, title, directory, time_created, time_updated FROM session WHERE project_id = ? ORDER BY time_created DESC").all(projectId);
console.log('\n=== SESSIONS (newest first) ===');
sessions.forEach(s => {
  const created = new Date(s.time_created).toISOString();
  const updated = new Date(s.time_updated).toISOString();
  console.log(s.id, '|', s.title || '(no title)', '| created:', created, '| dir:', s.directory);
});

db.close();
