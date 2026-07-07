import json
import os
import re

def strip_comments(text):
    lines = text.splitlines()
    clean_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("//"):
            continue
        clean_lines.append(line)
    return "\n".join(clean_lines)

with open("data/arborescance.json", "r", encoding="utf-8") as f:
    raw = f.read()

clean = strip_comments(raw)

# Extract JSON objects by finding matching braces
objects = []
start = 0
while start < len(clean):
    idx = clean.find("{", start)
    if idx == -1:
        break
    # Find matching closing brace
    depth = 0
    end = idx
    while end < len(clean):
        if clean[end] == "{":
            depth += 1
        elif clean[end] == "}":
            depth -= 1
            if depth == 0:
                break
        end += 1
    if depth == 0:
        obj_str = clean[idx:end+1]
        try:
            obj = json.loads(obj_str)
            objects.append(obj)
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON at position {idx}: {e}")
            print(obj_str[:200])
        start = end + 1
    else:
        break

print(f"Found {len(objects)} JSON objects")

if len(objects) >= 2:
    obj1 = objects[0]
    obj2 = objects[1]
else:
    raise ValueError(f"Expected at least 2 JSON objects, found {len(objects)}")

base_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.local-db')

# Clean previous misplaced roots if they exist at repo root
repo_root = os.path.dirname(os.path.abspath(__file__))
for misplaced in ['Centrale', 'Groupes']:
    mp = os.path.join(repo_root, misplaced)
    if os.path.exists(mp):
        import shutil
        shutil.rmtree(mp)

for key, data in obj1.items():
    root = os.path.join(base_dir, key)
    os.makedirs(root, exist_ok=True)
    for block_key, block_data in data.items():
        block_dir = os.path.join(root, block_key)
        os.makedirs(block_dir, exist_ok=True)
        for desc in block_data.get("descendants", []):
            desc_dir = os.path.join(block_dir, desc["nom"])
            os.makedirs(desc_dir, exist_ok=True)

for key, data in obj2.items():
    root = os.path.join(base_dir, key)
    os.makedirs(root, exist_ok=True)
    for group_name, group_data in data.items():
        group_dir = os.path.join(root, group_name)
        os.makedirs(group_dir, exist_ok=True)
        for desc in group_data.get("descendants", []):
            desc_dir = os.path.join(group_dir, desc["nom"])
            os.makedirs(desc_dir, exist_ok=True)

print("Done")
