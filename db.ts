import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.join(process.cwd(), "portfolio.db"));

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    images TEXT, -- JSON string array
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS portfolio_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export default db;

export const saveMessage = (sessionId: string, role: string, content: string, images: string[] = []) => {
  const stmt = db.prepare("INSERT INTO chat_history (session_id, role, content, images) VALUES (?, ?, ?, ?)");
  return stmt.run(sessionId, role, content, JSON.stringify(images));
};

export const getHistory = (sessionId: string) => {
  const stmt = db.prepare("SELECT * FROM chat_history WHERE session_id = ? ORDER BY timestamp ASC");
  return stmt.all(sessionId);
};

export const clearHistory = (sessionId: string) => {
  const stmt = db.prepare("DELETE FROM chat_history WHERE session_id = ?");
  return stmt.run(sessionId);
};

export const getPortfolioMetadata = () => {
  const rows = db.prepare("SELECT * FROM portfolio_metadata").all();
  const metadata: any = {};
  rows.forEach((row: any) => {
    try {
      metadata[row.key] = JSON.parse(row.value);
    } catch (e) {
      metadata[row.key] = row.value;
    }
  });
  return metadata;
};

export const updatePortfolioMetadata = (data: any) => {
  const insert = db.prepare("INSERT OR REPLACE INTO portfolio_metadata (key, value) VALUES (?, ?)");
  const transaction = db.transaction((data: any) => {
    for (const key in data) {
      insert.run(key, JSON.stringify(data[key]));
    }
  });
  transaction(data);
};
