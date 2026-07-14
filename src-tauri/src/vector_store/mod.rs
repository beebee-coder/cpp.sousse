pub mod types;
pub mod embedding;
pub mod storage;
pub mod indexer;
pub mod search;

pub use types::{Document, DocumentMetadata, SearchResult, IndexStats};
pub use embedding::{tokenize_with_stems, cosine_similarity};
pub use storage::VectorStore;
pub use indexer::DocumentIndexer;
