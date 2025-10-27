-- SQL schema for ToBeNB-TeenCare
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  display_name TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id UUID PRIMARY KEY,
  user_id TEXT REFERENCES users(user_id),
  started_at TIMESTAMP DEFAULT now(),
  finished_at TIMESTAMP,
  current_stage TEXT
);

CREATE TABLE IF NOT EXISTS screening_9q (
  id SERIAL PRIMARY KEY,
  session_id UUID REFERENCES sessions(session_id),
  q1 smallint, q2 smallint, q3 smallint, q4 smallint, q5 smallint, q6 smallint, q7 smallint, q8 smallint, q9 smallint,
  total_score smallint,
  risk_level TEXT,
  red_flag boolean,
  consent boolean,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS forwards (
  id SERIAL PRIMARY KEY,
  session_id UUID REFERENCES sessions(session_id),
  forwarded_to TEXT[],
  consent boolean,
  forwarded_at TIMESTAMP DEFAULT now(),
  note TEXT
);

CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  session_id UUID,
  event_type TEXT,
  payload JSONB,
  created_at TIMESTAMP DEFAULT now()
);
