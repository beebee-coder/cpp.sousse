# VisioNode — data/chromadb/datasets/

Ce répertoire contient les fichiers **JSONL** générés par la fonctionnalité "Générateur RAG & Datasets" (/dataset).

## Structure des fichiers

Chaque fichier `.jsonl` contient une paire par ligne au format :

```jsonl
{"question":"...","answer":"...","collection":"industrial_manuals","category":"maintenance"}
{"question":"...","answer":"...","collection":"industrial_manuals","category":"maintenance"}
```

## Pipeline d'ingestion

```
/dataset (UI)
  → POST /api/vector/ingest
    → Sauvegarde JSONL  → data/chromadb/datasets/<filename>.jsonl
    → Vectorisation     → ChromaDB collection (ex: industrial_manuals)
                           http://127.0.0.1:8000 (npm run chroma:start)
    → RAG disponible    → Chat IA (/chat) + Vision RAG (/dashboard)
```

## Collections disponibles

- `industrial_manuals` : Collection principale (manuels + datasets utilisateur)
- Toute autre collection créée via l'interface Dataset

## Démarrage ChromaDB

```bash
npm run chroma:start
# Équivalent : chroma run --host 127.0.0.1 --port 8000 --path ./data/chromadb
```

> Les fichiers JSONL servent de backup disque. Même si ChromaDB est hors-ligne lors de l'ingestion,
> le fichier reste sauvegardé ici et peut être ré-indexé ultérieurement.
