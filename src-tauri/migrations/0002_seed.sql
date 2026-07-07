-- 0002_seed.sql — Pré-remplissage de la DB locale (baseline)
-- Exécuté une seule fois au premier lancement. Le hash correspond à 'admin123'.
INSERT OR IGNORE INTO users (id, email, firstName, lastName, password, role, approved, createdAt, updatedAt)
VALUES (
  'admin-root-001',
  'admin@visionode.local',
  'Ahmed',
  'Admin',
  '$2a$12$yL8tj4.MM3zVHJPQH8eG1e2WhuIO8e.ZyMEakNbBazTtZQ2z6EpLi',
  'admin',
  1,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO knowledge_items (id, title, type, question, answer, tags, category, userId, createdAt, updatedAt)
VALUES (
  'seed-k-epi-crf',
  'Sécurité CRF - EPI Obligatoires',
  'qa',
  'Quels sont les EPI obligatoires en zone CRF ?',
  'Casque de sécurité, gants anti-coupure, lunettes de protection S3, chaussures de sécurité.',
  '["EPI","Sécurité","CRF"]',
  'Sécurité',
  'admin-root-001',
  datetime('now'),
  datetime('now')
);
