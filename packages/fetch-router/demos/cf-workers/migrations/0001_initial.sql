CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Insert initial demo data
INSERT INTO posts (title, content, author, created_at) VALUES
  ('Welcome to the Blog', 'This is a simple blog demo built with fetch-router on Cloudflare Workers.', 'Admin', strftime('%s', '2025-01-01')),
  ('Getting Started with fetch-router', 'fetch-router is a minimal, composable router built on the web Fetch API.', 'Admin', strftime('%s', '2025-01-02'));


