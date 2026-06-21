import sqlite3
import os

db_path = r'f:\cpp.sousse-initiale1\cpp.sousse-main\data\chromadb\chroma.sqlite3'
print(f"DB path: {db_path}")
print(f"Exists: {os.path.exists(db_path)}")
print(f"Size: {os.path.getsize(db_path)} bytes")
print()

conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Integrity check
cur.execute('PRAGMA integrity_check;')
print(f"Integrity check: {cur.fetchone()}")

# Tables
cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
tables = [r[0] for r in cur.fetchall()]
print(f"Tables ({len(tables)}): {tables}")
print()

# Row counts per table
for t in tables:
    try:
        cur.execute(f"SELECT COUNT(*) FROM {t};")
        print(f"  {t}: {cur.fetchone()[0]} rows")
    except Exception as e:
        print(f"  {t}: ERROR {e}")

conn.close()