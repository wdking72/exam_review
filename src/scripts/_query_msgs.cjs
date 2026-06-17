const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('C:/Users/wdking/.local/share/mimocode/mimocode.db', { open: true, readOnly: true });

// Get recent sessions (last 7 days: June 9-16)
const sessions = [
  'ses_130c3b281ffeuQJuOxxgTDAxDr',  // 继续学习Koa
  'ses_130c551aaffetl7TU4RXW8SkiT',  // 你是哪个模型
  'ses_130c5506effeE6RUG2XfasAB7w',  // skill放在哪里
  'ses_130c55022ffe13cxCjaX3CBX1P',  // 学习koa框架
  'ses_130c55103ffewgQgg1anJ89QRg',  // 后端项目吗
  'ses_130c550bbffeLJ4Ck05wNBJGer',  // 继续学习RAG
  'ses_130c55183ffeC6HWoqV56o8JUP',  // github管理项目
  'ses_130c55165ffekvcq30YqskmS6c',  // 继续学习agent
  'ses_130c55059ffejHIuXfOkHE6ZY7',  // 继续学agent
  'ses_130c550e3ffeyl7Q1PNKSAfC6C',  // 继续学Agent
];

// Get user messages (role=user) from each session to understand what was discussed
for (const sid of sessions) {
  const msgs = db.prepare(`
    SELECT m.id, m.time_created, m.data
    FROM message m
    WHERE m.session_id = ?
      AND json_extract(m.data, '$.role') = 'user'
    ORDER BY m.time_created
  `).all(sid);
  
  console.log('\n=== SESSION: ' + sid + ' ===');
  msgs.forEach(m => {
    const d = JSON.parse(m.data);
    const text = d.content ? (typeof d.content === 'string' ? d.content : JSON.stringify(d.content).substring(0, 300)) : '(no content)';
    console.log('  [' + new Date(m.time_created).toISOString() + '] ' + text.substring(0, 200));
  });
}
db.close();
