use crate::vector_store::types::{Document, IndexStats, SearchResult};
use crate::vector_store::embedding::{Vocabulary, compute_tfidf_vector, tokenize_with_stems};
use rusqlite::{Connection, params, Result as SqliteResult};
use std::path::PathBuf;
use std::sync::Mutex;

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

    pub fn build_vocabulary(&self, documents: &[Document]) {
        let mut vocab = self.vocab.lock().unwrap();
        vocab.fit(documents);
    }

    pub fn index_documents(&self, documents: Vec<Document>) -> SqliteResult<IndexStats> {
        let vocab = self.vocab.lock().unwrap();
        let mut conn = self.conn.lock().unwrap();

        let tx = conn.unchecked_transaction()?;

        for doc in &documents {
            let tokens = tokenize_with_stems(&doc.content);
            let vector = compute_tfidf_vector(&tokens, &vocab);
            let vector_bytes: Vec<u8> = vector.iter().flat_map(|&f| f.to_le_bytes()).collect();

            tx.execute(
                "INSERT OR REPLACE INTO documents (id, content, metadata, chunk_index, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![doc.id, doc.content, serde_json::to_string(&doc.metadata).unwrap(), doc.chunk_index as i32, doc.created_at],
            )?;

            tx.execute(
                "INSERT OR REPLACE INTO embeddings (document_id, vector) VALUES (?1, ?2)",
                params![doc.id, vector_bytes],
            )?;
        }

        tx.commit()?;

        Ok(IndexStats {
            total_documents: self.count_documents(),
            total_chunks: documents.len(),
            vocabulary_size: vocab.terms.len(),
            embedding_dimensions: self.dimensions,
        })
    }

    pub fn search(&self, query: &str, top_k: usize) -> SqliteResult<Vec<SearchResult>> {
        let vocab = self.vocab.lock().unwrap();
        let conn = self.conn.lock().unwrap();

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
                serde_json::from_str(&metadata_str).unwrap_or_default();

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

        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
        results.truncate(top_k);

        Ok(results)
    }

    pub fn get_document(&self, id: &str) -> SqliteResult<Option<crate::vector_store::types::Document>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, content, metadata, chunk_index, created_at FROM documents WHERE id = ?1")?;
        let result = stmt.query_row(params![id], |row| {
            let id: String = row.get(0)?;
            let content: String = row.get(1)?;
            let metadata_str: String = row.get(2)?;
            let chunk_index: i32 = row.get(3)?;
            let created_at: String = row.get(4)?;
            let metadata: crate::vector_store::types::DocumentMetadata =
                serde_json::from_str(&metadata_str).unwrap_or_default();
            Ok(crate::vector_store::types::Document {
                id,
                content,
                metadata,
                chunk_index: chunk_index as usize,
                created_at,
            })
        });

        match result {
            Ok(doc) => Ok(Some(doc)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn count_documents(&self) -> usize {
        let conn = self.conn.lock().unwrap();
        conn.query_row("SELECT COUNT(*) FROM documents", [], |row| row.get(0)).unwrap_or(0)
    }

    pub fn clear(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM embeddings", [])?;
        conn.execute("DELETE FROM documents", [])?;
        Ok(())
    }

    pub fn get_stats(&self) -> IndexStats {
        let vocab = self.vocab.lock().unwrap();
        IndexStats {
            total_documents: self.count_documents(),
            total_chunks: self.count_documents(),
            vocabulary_size: vocab.terms.len(),
            embedding_dimensions: self.dimensions,
        }
    }
}
