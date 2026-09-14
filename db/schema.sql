-- Dedicated Weekend store. No shared/Kivo schema. No customer photo bytes.
CREATE TABLE IF NOT EXISTS subjects (
  subject_id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  role TEXT NOT NULL,
  token_hmac TEXT NOT NULL,
  verified INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
);

CREATE TABLE IF NOT EXISTS permission_receipts (
  receipt_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  notice_version TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  revoked_at TEXT,
  retention_policy_key TEXT NOT NULL,
  granted_via TEXT NOT NULL,
  FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
);

CREATE TABLE IF NOT EXISTS preferences (
  preference_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  value_text TEXT NOT NULL,
  source TEXT NOT NULL,
  provenance TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
);

CREATE TABLE IF NOT EXISTS allowed_actions (
  action_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  label_ar TEXT NOT NULL,
  label_en TEXT NOT NULL,
  session_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  object_id TEXT NOT NULL,
  object_version INTEGER NOT NULL,
  requires_receipt_kind TEXT,
  expires_at TEXT NOT NULL,
  url TEXT,
  consumed_at TEXT,
  payload_json TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id),
  FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
);

CREATE TABLE IF NOT EXISTS action_results (
  action_id TEXT PRIMARY KEY,
  outcome TEXT NOT NULL,
  receipt_id TEXT,
  message_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS briefs (
  brief_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  barber_preference TEXT,
  option_id TEXT,
  text_ar TEXT NOT NULL,
  do_not_json TEXT NOT NULL,
  ref_kind TEXT NOT NULL,
  image_ref TEXT,
  receipt_id TEXT,
  approved_by_subject_at TEXT,
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
);

CREATE TABLE IF NOT EXISTS delivery_receipts (
  brief_id TEXT PRIMARY KEY,
  delivered_at TEXT NOT NULL,
  staff_view_id TEXT NOT NULL,
  acknowledged_at TEXT,
  acknowledged_by TEXT
);

CREATE TABLE IF NOT EXISTS pending_requests (
  request_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_records (
  usage_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  turn_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  cost_estimate_minor INTEGER,
  outcome TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS images (
  image_ref TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_spend (
  day TEXT PRIMARY KEY,
  calls INTEGER NOT NULL,
  cost_minor INTEGER NOT NULL
);

-- Text observations only. Image bytes never land here or on disk.
CREATE TABLE IF NOT EXISTS photo_observations (
  image_ref TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  observations_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id),
  FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
);

CREATE TABLE IF NOT EXISTS turns (
  session_id TEXT NOT NULL,
  turn_id TEXT NOT NULL,
  status TEXT NOT NULL,
  response_json TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (session_id, turn_id),
  FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);
