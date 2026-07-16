use crate::vector_store::types::{Document, IndexStats, SearchResult};
use crate::vector_store::embedding::{Vocabulary, compute_tfidf_vector, tokenize_with_stems};
use rusqlite::{Connection, params, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Serialize, Deserialize)]
struct PersistedVocab {
    dimensions: usize,
    terms: Vec<String>,
    term_to_index: Vec<(String, usize)>,
    document_frequencies: Vec<(String, usize)>,
    total_documents: usize,
}

impl From<&Vocabulary> for PersistedVocab {
    fn from(v: &Vocabulary) -> Self {
        Self {
            dimensions: v.dimensions,
            terms: v.terms.clone(),
            term_to_index: v.term_to_index.iter().map(|(k, i)| (k.clone(), *i)).collect(),
            document_frequencies: v.document_frequencies.iter().map(|(k, v)| (k.clone(), *v)).collect(),
            total_documents: v.total_documents,
        }
    }
}

impl From<PersistedVocab> for Vocabulary {
    fn from(p: PersistedVocab) -> Self {
        let mut vocab = Vocabulary::new(p.dimensions);
        vocab.terms = p.terms;
        vocab.term_to_index = p.term_to_index.into_iter().collect();
        vocab.document_frequencies = p.document_frequencies.into_iter().collect();
        vocab.total_documents = p.total_documents;
        vocab
    }
}

#[derive(Debug)]
pub enum StoreError {
    Sqlite(rusqlite::Error),
    Serde(serde_json::Error),
}

impl std::fmt::Display for StoreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StoreError::Sqlite(e) => write!(f, "{}", e),
            StoreError::Serde(e) => write!(f, "{}", e),
        }
    }
}

impl std::error::Error for StoreError {}

impl From<rusqlite::Error> for StoreError {
    fn from(e: rusqlite::Error) -> Self { StoreError::Sqlite(e) }
}

impl From<serde_json::Error> for StoreError {
    fn from(e: serde_json::Error) -> Self { StoreError::Serde(e) }
}

pub struct VectorStore {
    conn: Mutex<Connection>,
    vocab: Mutex<Vocabulary>,
    dimensions: usize,
}

impl VectorStore {
    pub fn new(db_path: PathBuf, dimensions: usize) -> SqliteResult<Self> {
        std::fs::create_dir_all(&db_path).ok();
        let db_file = db_path.join("vectors.db");
        let conn = Connection::open(db_file)?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                metadata TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS embeddings (
                document_id TEXT PRIMARY KEY,
                vector BLOB NOT NULL,
                FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS vocabulary (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                data TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_documents_origin ON documents(json_extract(metadata, '$.origin'));
            CREATE INDEX IF NOT EXISTS idx_documents_path ON documents(json_extract(metadata, '$.file_path'));"
        )?;

        let vocab = Mutex::new(Vocabulary::new(dimensions));

        Ok(Self {
            conn: Mutex::new(conn),
            vocab,
            dimensions,
        })
    }

    pub fn load_vocabulary(&self) -> Result<(), StoreError> {
        let conn = self.lock_conn()?;
        let mut stmt = conn.prepare("SELECT data FROM vocabulary WHERE id = 1")?;
        let result = stmt.query_row([], |row| {
            let data: String = row.get(0)?;
            Ok(data)
        });

        if let Ok(data) = result {
            if let Ok(persisted) = serde_json::from_str::<PersistedVocab>(&data) {
                let mut vocab = self.lock_vocab()?;
                *vocab = Vocabulary::from(persisted);
            }
        }

        Ok(())
    }

    /// Persiste le vocabulaire courant. API publique conservée pour les
    /// ré-indexations autonomes (hors du flux `index_documents` qui persiste
    /// déjà en interne); utilisée par les runners de test et l'indexation
    /// manuelle depuis le frontend.
    #[allow(dead_code)]
    pub fn persist_vocabulary(&self) -> Result<(), StoreError> {
        let vocab = self.lock_vocab()?;
        let persisted = PersistedVocab::from(&*vocab);
        let data = serde_json::to_string(&persisted)?;

        let conn = self.lock_conn()?;
        conn.execute(
            "INSERT OR REPLACE INTO vocabulary (id, data) VALUES (1, ?1)",
            params![data],
        )?;

        Ok(())
    }

    /// Verrouille la connexion SQLite en récupérant proprement un état empoisonné
    /// (un thread précédent a paniqué). On récupère les données valides plutôt que
    /// de propager l'erreur et de rendre la DB inutilisable pour toute la session.
    fn lock_conn(&self) -> Result<std::sync::MutexGuard<'_, Connection>, StoreError> {
        match self.conn.lock() {
            Ok(guard) => Ok(guard),
            Err(poisoned) => {
                eprintln!("[VECTOR_STORE] Mutex connexion empoisonné — récupération des données valides.");
                Ok(poisoned.into_inner())
            }
        }
    }

    /// Verrouille le vocabulaire en récupérant proprement un état empoisonné.
    fn lock_vocab(&self) -> Result<std::sync::MutexGuard<'_, Vocabulary>, StoreError> {
        match self.vocab.lock() {
            Ok(guard) => Ok(guard),
            Err(poisoned) => {
                eprintln!("[VECTOR_STORE] Mutex vocabulaire empoisonné — récupération des données valides.");
                Ok(poisoned.into_inner())
            }
        }
    }

    pub fn build_vocabulary(&self, documents: &[Document]) {
        if let Ok(mut vocab) = self.lock_vocab() {
            vocab.fit(documents);
        }
    }

    pub fn index_documents(&self, documents: Vec<Document>) -> Result<IndexStats, StoreError> {
        let vocab = self.lock_vocab()?;
        let mut conn = self.lock_conn()?;

        // Persiste le vocabulaire AVANT l'indexation : si le process meurt pendant
        // l'indexation, la table vocabulary reste cohérente avec les embeddings.
        let persisted = PersistedVocab::from(&*vocab);
        let vocab_data = serde_json::to_string(&persisted)?;
        conn.execute(
            "INSERT OR REPLACE INTO vocabulary (id, data) VALUES (1, ?1)",
            params![vocab_data],
        )?;

        let tx = conn.transaction()?;

        let mut indexed = 0usize;
        for doc in &documents {
            let tokens = tokenize_with_stems(&doc.content);
            let vector = compute_tfidf_vector(&tokens, &vocab);
            let vector_bytes: Vec<u8> = vector.iter().flat_map(|&f| f.to_le_bytes()).collect();

            let metadata_str = serde_json::to_string(&doc.metadata)?;

            tx.execute(
                "INSERT OR REPLACE INTO documents (id, content, metadata, chunk_index, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![doc.id, doc.content, metadata_str, doc.chunk_index as i32, doc.created_at],
            )?;

            tx.execute(
                "INSERT OR REPLACE INTO embeddings (document_id, vector) VALUES (?1, ?2)",
                params![doc.id, vector_bytes],
            )?;
            indexed += 1;
        }

        tx.commit()?;

        Ok(IndexStats {
            total_documents: self.count_documents()?,
            total_chunks: indexed,
            vocabulary_size: vocab.terms.len(),
            embedding_dimensions: self.dimensions,
        })
    }

    pub fn search(&self, query: &str, top_k: usize) -> Result<Vec<SearchResult>, StoreError> {
        let vocab = self.lock_vocab()?;
        let conn = self.lock_conn()?;

        let tokens = tokenize_with_stems(query);
        let query_vector = compute_tfidf_vector(&tokens, &vocab);

        let mut stmt = conn.prepare("SELECT id, content, metadata, chunk_index, created_at, vector FROM documents d JOIN embeddings e ON d.id = e.document_id")?;

        let mut results: Vec<SearchResult> = Vec::new();

        let rows = stmt.query_map([], |row| {
            let id: String = row.get(0)?;
            let content: String = row.get(1)?;
            let metadata_str: String = row.get(2)?;
            let chunk_index: i32 = row.get(3)?;
            let created_at: String = row.get(4)?;
            let vector_bytes: Vec<u8> = row.get(5)?;

            let metadata: crate::vector_store::types::DocumentMetadata =
                serde_json::from_str(&metadata_str).map_err(|e| {
                    eprintln!("[VECTOR_STORE] Erreur parsing metadata: {} — doc_id={}", e, id);
                    rusqlite::Error::FromSqlConversionFailure(1, rusqlite::types::Type::Text, Box::new(e))
                })?;

            let doc = Document {
                id,
                content,
                metadata,
                chunk_index: chunk_index as usize,
                created_at,
            };

            let vector: Vec<f32> = vector_bytes
                .chunks_exact(4)
                .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
                .collect();

            Ok((doc, vector))
        })?;

        for row in rows {
            let (doc, vector) = row?;
            let score = crate::vector_store::embedding::cosine_similarity(&query_vector, &vector);
            results.push(SearchResult { document: doc, score });
        }

        // Score cosinus : plus élevé = plus pertinent. On trie en ordre
        // DÉCROISSANT avant de tronquer, sinon `truncate(top_k)` conserve les
        // documents les MOINS pertinents.
        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        results.truncate(top_k);

        Ok(results)
    }

    /// Renvoie l'ensemble des `content_hash` déjà indexés (stockés dans
    /// `metadata.extra.content_hash`), pour une indexation incrémentale.
    pub fn indexed_content_hashes(&self) -> std::collections::HashSet<String> {
        let mut set = std::collections::HashSet::new();
        let conn = match self.lock_conn() {
            Ok(c) => c,
            Err(_) => return set,
        };
        let mut stmt = match conn.prepare("SELECT metadata FROM documents") {
            Ok(s) => s,
            Err(_) => return set,
        };
        let rows = match stmt.query_map([], |row| {
            let metadata_str: String = row.get(0)?;
            Ok(metadata_str)
        }) {
            Ok(r) => r,
            Err(_) => return set,
        };
        for row in rows.flatten() {
            if let Ok(metadata) = serde_json::from_str::<serde_json::Value>(&row) {
                if let Some(hash) = metadata
                    .get("content_hash")
                    .and_then(|v| v.as_str())
                {
                    set.insert(hash.to_string());
                }
            }
        }
        set
    }

    pub fn count_documents(&self) -> Result<usize, StoreError> {
        let conn = self.lock_conn()?;
        conn.query_row("SELECT COUNT(*) FROM documents", [], |row| row.get(0))
            .map_err(|e| {
                eprintln!("[VECTOR_STORE] count_documents échoué: {}", e);
                StoreError::Sqlite(e)
            })
    }

    pub fn clear(&self) -> Result<(), StoreError> {
        let conn = self.lock_conn()?;
        conn.execute("DELETE FROM embeddings", [])?;
        conn.execute("DELETE FROM documents", [])?;
        Ok(())
    }

    pub fn reset_vocab(&self) {
        if let Ok(mut vocab) = self.lock_vocab() {
            vocab.terms.clear();
            vocab.term_to_index.clear();
            vocab.document_frequencies.clear();
            vocab.total_documents = 0;
        }
    }

    pub fn get_stats(&self) -> Result<IndexStats, StoreError> {
        let vocab = self.lock_vocab()?;
        Ok(IndexStats {
            total_documents: self.count_documents()?,
            total_chunks: self.count_documents()?,
            vocabulary_size: vocab.terms.len(),
            embedding_dimensions: self.dimensions,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vector_store::types::DocumentMetadata;

    fn tmp_store() -> VectorStore {
        let mut dir = std::env::temp_dir();
        dir.push(format!("vec_store_test_{}", std::process::id()));
        dir.push(format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        VectorStore::new(dir, 256).expect("store")
    }

    fn doc(id: &str, content: &str) -> Document {
        Document {
            id: id.to_string(),
            content: content.to_string(),
            metadata: DocumentMetadata { origin: "TEST".into(), ..Default::default() },
            chunk_index: 0,
            created_at: "now".into(),
        }
    }

    #[test]
    fn search_retourne_le_plus_pertinent_en_premier() {
        let store = tmp_store();
        let docs = vec![
            doc("a", "pompe hydraulique pression maintenance"),
            doc("b", "gâteau chocolat recette dessert sucre"),
            doc("c", "moteur électrique rotation vitesse"),
        ];
        store.build_vocabulary(&docs);
        store.index_documents(docs).expect("index");

        let results = store.search("pompe hydraulique pression", 3).expect("search");
        assert!(!results.is_empty());
        // Régression bug #1 : le meilleur score doit être en tête (tri décroissant).
        assert_eq!(results[0].document.id, "a");
        for w in results.windows(2) {
            assert!(w[0].score >= w[1].score, "les résultats doivent être triés par score décroissant");
        }
    }
}
