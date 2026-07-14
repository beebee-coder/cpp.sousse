use crate::vector_store::storage::VectorStore;
use crate::vector_store::types::Document;
use std::fs;
use std::path::Path;

const CHUNK_SIZE: usize = 500;
const CHUNK_OVERLAP: usize = 100;

pub struct DocumentIndexer {
    store: std::sync::Arc<VectorStore>,
    local_db_root: String,
}

impl DocumentIndexer {
    pub fn new(store: std::sync::Arc<VectorStore>, local_db_root: String) -> Self {
        Self { store, local_db_root }
    }

    pub fn index_local_db(&self) -> Result<crate::vector_store::types::IndexStats, String> {
        let root = Path::new(&self.local_db_root);
        if !root.exists() {
            return Ok(self.store.get_stats());
        }

        let documents = self.scan_directory(root, None);
        if documents.is_empty() {
            return Ok(self.store.get_stats());
        }

        self.store.build_vocabulary(&documents);
        self.store.index_documents(documents).map_err(|e| e.to_string())
    }

    pub fn index_file(&self, file_path: &str) -> Result<crate::vector_store::types::IndexStats, String> {
        let path = Path::new(file_path);
        if !path.exists() {
            return Err("File not found".to_string());
        }

        let content = fs::read_to_string(file_path).map_err(|e| e.to_string())?;
        let metadata = self.build_metadata(file_path, &content);
        let chunks = self.chunk_text(&content, &metadata);

        self.store.build_vocabulary(&chunks);
        self.store.index_documents(chunks).map_err(|e| e.to_string())
    }

    fn scan_directory(&self, dir: &Path, parent_dir: Option<String>) -> Vec<Document> {
        let mut documents = Vec::new();

        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let file_name = entry.file_name().to_string_lossy().to_string();

                if path.is_dir() {
                    let new_parent = match &parent_dir {
                        Some(p) => Some(format!("{}/{}", p, file_name)),
                        None => Some(file_name),
                    };
                    documents.extend(self.scan_directory(&path, new_parent));
                } else if Self::is_text_file(&path) {
                    if let Ok(content) = fs::read_to_string(&path) {
                        let metadata = self.build_metadata(path.to_str().unwrap_or(""), &content);
                        let chunks = self.chunk_text(&content, &metadata);
                        documents.extend(chunks);
                    }
                }
            }
        }

        documents
    }

    fn build_metadata(&self, file_path: &str, _content: &str) -> crate::vector_store::types::DocumentMetadata {
        let path = Path::new(file_path);
        let file_name = path.file_name().map(|n| n.to_string_lossy().to_string());
        let parent_dir = path.parent().map(|p| p.to_string_lossy().to_string());

        crate::vector_store::types::DocumentMetadata {
            origin: "LOCAL_DB".to_string(),
            file_name,
            parent_dir,
            file_path: file_path.to_string(),
            extra: std::collections::HashMap::new(),
        }
    }

    fn chunk_text(&self, content: &str, metadata: &crate::vector_store::types::DocumentMetadata) -> Vec<Document> {
        let mut chunks = Vec::new();
        let text = content.trim();

        if text.len() <= CHUNK_SIZE {
            chunks.push(Document {
                id: format!("{}-chunk-0", metadata.file_path.replace(['/', '\\'], "_")),
                content: text.to_string(),
                metadata: metadata.clone(),
                chunk_index: 0,
                created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            });
            return chunks;
        }

        let sentences: Vec<&str> = text.split(&['\n', '.', '!', '?']).collect();
        let mut current_chunk = String::new();
        let mut chunk_index = 0;

        for sentence in sentences {
            let sentence = sentence.trim();
            if sentence.is_empty() {
                continue;
            }

            if current_chunk.len() + sentence.len() > CHUNK_SIZE && !current_chunk.is_empty() {
                chunks.push(Document {
                    id: format!("{}-chunk-{}", metadata.file_path.replace(['/', '\\'], "_"), chunk_index),
                    content: current_chunk.trim().to_string(),
                    metadata: metadata.clone(),
                    chunk_index,
                    created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                });
                chunk_index += 1;
                current_chunk = sentence.to_string();
            } else {
                if !current_chunk.is_empty() {
                    current_chunk.push(' ');
                }
                current_chunk.push_str(sentence);
            }
        }

        if !current_chunk.trim().is_empty() {
            chunks.push(Document {
                id: format!("{}-chunk-{}", metadata.file_path.replace(['/', '\\'], "_"), chunk_index),
                content: current_chunk.trim().to_string(),
                metadata: metadata.clone(),
                chunk_index,
                created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            });
        }

        chunks
    }

    fn is_text_file(path: &Path) -> bool {
        if let Some(ext) = path.extension() {
            let ext = ext.to_string_lossy().to_lowercase();
            matches!(ext.as_str(), "txt" | "md" | "json" | "csv" | "xml" | "log" | "yaml" | "yml" | "text" | "rst")
        } else {
            false
        }
    }
}
