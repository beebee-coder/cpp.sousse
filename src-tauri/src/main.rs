// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::env;
use std::sync::Arc;
use dotenvy::dotenv;
use reqwest::StatusCode;

#[derive(Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize, Deserialize)]
struct ChatOutput {
    text: String,
    provider: String,
}

#[derive(Serialize, Deserialize)]
struct SearchOutput {
    results: Vec<SearchResultItem>,
    total: usize,
}

#[derive(Serialize, Deserialize)]
struct SearchResultItem {
    id: String,
    content: String,
    score: f32,
    metadata: SearchMetadata,
}

#[derive(Serialize, Deserialize)]
struct SearchMetadata {
    origin: String,
    file_name: Option<String>,
    parent_dir: Option<String>,
    file_path: String,
}

#[derive(Serialize, Deserialize)]
struct IndexStatsOutput {
    total_documents: usize,
    total_chunks: usize,
    vocabulary_size: usize,
    embedding_dimensions: usize,
}

use tauri::Manager;
use tauri_plugin_sql::{Builder, Migration, MigrationKind};

mod vector_store;
mod offline_generator;
use vector_store::{VectorStore, DocumentIndexer};
use vector_store::search::VectorSearchEngine;
use vector_store::types::Document;

const LOCAL_DB_URL: &str = "sqlite:visionode.sqlite";
const GROQ_TIMEOUT_SECS: u64 = 30;
const GROQ_RETRIES: u32 = 2;
const GROQ_RETRY_DELAY_MS: u64 = 1000;
const LOCAL_DB_ROOT: &str = ".local-db";

/// Résout le répertoire `.local-db` physique de façon hybride.
/// En EXE desktop, le frontend Next écrit dans `process.cwd()/.local-db`
/// (dossier de l'exécutable). On cherche donc dans :
///   1. le dossier parent de l'exécutable (cwd de l'app packagée)
///   2. le `app_data_dir` (emplacement historique du natif)
/// et on retourne le premier qui existe, sinon le dossier exe (création).
fn resolve_local_db_root<T: tauri::Manager<tauri::Wry>>(app: &T) -> std::path::PathBuf {
    // 1. Dossier parent de l'exécutable (cwd de l'app packagée EXE) :
    //    en production le frontend Next écrit dans `process.cwd()/.local-db`.
    if let Ok(exe_path) = env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let exe_root = exe_dir.join(LOCAL_DB_ROOT);
            if exe_root.exists() {
                return exe_root;
            }
            // 2. Remonte l'arborescence depuis l'exe (cas dev : target/debug → racine projet)
            //    pour trouver un `.local-db` existant écrit par le frontend Next.
            let mut cur = Some(exe_dir.to_path_buf());
            while let Some(dir) = cur {
                let candidate = dir.join(LOCAL_DB_ROOT);
                if candidate.exists() {
                    return candidate;
                }
                cur = dir.parent().map(|p| p.to_path_buf());
            }
        }
    }
    // 3. Emplacement historique du natif (app_data_dir).
    if let Ok(app_data_dir) = app.path().app_data_dir() {
        let data_root = app_data_dir.join(LOCAL_DB_ROOT);
        if data_root.exists() {
            return data_root;
        }
    }
    // Par défaut : dossier parent de l'exécutable (cohérent avec le frontend).
    env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join(LOCAL_DB_ROOT)))
        .unwrap_or_else(|| std::path::PathBuf::from(LOCAL_DB_ROOT))
}

#[tauri::command]
fn get_local_db_root(app: tauri::AppHandle) -> String {
    resolve_local_db_root(&app).to_string_lossy().to_string()
}

fn local_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "schema initial",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "seed baseline (admin + connaissances)",
            sql: include_str!("../migrations/0002_seed.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[tauri::command]
async fn index_local_db(app: tauri::AppHandle) -> Result<IndexStatsOutput, String> {
    let store = get_vector_store(&app)?;
    let db_root = resolve_local_db_root(&app);

    let stats = tokio::task::spawn_blocking(move || {
        let indexer = DocumentIndexer::new(store, db_root.to_string_lossy().to_string());
        indexer.index_local_db()
    })
    .await
    .map_err(|e| format!("Indexation annulée: {}", e))??;

    Ok(IndexStatsOutput {
        total_documents: stats.total_documents,
        total_chunks: stats.total_chunks,
        vocabulary_size: stats.vocabulary_size,
        embedding_dimensions: stats.embedding_dimensions,
    })
}

fn is_retryable_status(status: StatusCode) -> bool {
    status == StatusCode::TOO_MANY_REQUESTS
        || status == StatusCode::INTERNAL_SERVER_ERROR
        || status == StatusCode::BAD_GATEWAY
        || status == StatusCode::SERVICE_UNAVAILABLE
        || status == StatusCode::GATEWAY_TIMEOUT
}

async fn call_groq_with_retry(
    client: reqwest::Client,
    groq_key: &str,
    messages: Vec<serde_json::Value>,
) -> Result<ChatOutput, String> {
    let mut last_error = String::new();

    for attempt in 0..=GROQ_RETRIES {
        match call_groq(&client, groq_key, &messages).await {
            Ok(output) => return Ok(output),
            Err(e) => {
                last_error = e;
                if attempt < GROQ_RETRIES {
                    let delay = GROQ_RETRY_DELAY_MS * 2_u64.pow(attempt);
                    eprintln!("[NATIVE_GROQ] Tentative {} échouée. Nouvelle tentative dans {}ms...", attempt + 1, delay);
                    tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                    continue;
                }
                break;
            }
        }
    }

    Err(last_error)
}

async fn call_groq(
    client: &reqwest::Client,
    groq_key: &str,
    messages: &[serde_json::Value],
) -> Result<ChatOutput, String> {
    let timeout = std::time::Duration::from_secs(GROQ_TIMEOUT_SECS);

    let res = client
        .post("https://api.groq.com/openai/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", groq_key))
        .header("Content-Type", "application/json")
        .timeout(timeout)
        .json(&serde_json::json!({
            "model": "llama-3.3-70b-versatile",
            "messages": messages,
            "temperature": 0.1,
            "max_tokens": 300
        }))
        .send()
        .await;

    match res {
        Ok(response) => {
            let status = response.status();
            if !status.is_success() && !is_retryable_status(status) {
                let err_text = response.text().await.unwrap_or_default();
                return Err(format!("ERREUR_API_GROQ (HTTP {}): {}", status, err_text));
            }
            if !status.is_success() {
                return Err(format!("ERREUR_API_GROQ (HTTP {})", status));
            }
            if let Ok(json) = response.json::<serde_json::Value>().await {
                if let Some(text) = json["choices"][0]["message"]["content"].as_str() {
                    eprintln!("[NATIVE_GROQ] Réponse générée.");
                    return Ok(ChatOutput {
                        text: text.to_string(),
                        provider: "GROQ/LLAMA-3.3 (NATIF)".to_string(),
                    });
                }
            }
            Err("ERREUR_REPONSE : Format de réponse invalide.".to_string())
        },
        Err(e) => {
            let err_msg = if e.is_timeout() {
                format!("Timeout {}s dépassé", GROQ_TIMEOUT_SECS)
            } else {
                format!("ERREUR_RESEAU : {}", e)
            };
            Err(err_msg)
        }
    }
}

/// Réponse 100% locale (sans Groq) : utilise le générateur léger embarqué qui
/// synthétise les passages RAG les plus pertinents. Aucune dépendance réseau.
fn offline_generate(rag_docs: &[Document], query: &str) -> ChatOutput {
    let text = offline_generator::OfflineGenerator::generate(rag_docs, query);
    ChatOutput {
        text,
        provider: "VISIONODE_LOCAL (offline, modèle léger RAG)".to_string(),
    }
}

fn get_vector_store(app: &tauri::AppHandle) -> Result<Arc<VectorStore>, String> {
    let state = app.state::<Arc<VectorStore>>();
    Ok(state.inner().clone())
}

#[tauri::command]
async fn chat_with_ia(
    app: tauri::AppHandle,
    message: String,
    history: Vec<ChatMessage>
) -> Result<ChatOutput, String> {
    if let Ok(exe_path) = env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let env_exe = exe_dir.join(".env");
            if env_exe.exists() {
                let _ = dotenvy::from_path(&env_exe);
            }
        }
    }

    for rel_path in &["_up_/.env", ".env"] {
        if let Ok(resource_path) = app.path().resolve(rel_path, tauri::path::BaseDirectory::Resource) {
            let resource_path: std::path::PathBuf = resource_path;
            if resource_path.exists() {
                let _ = dotenvy::from_path(&resource_path);
                break;
            }
        }
    }

    let _ = dotenv();

    let groq_key = env::var("GROQ_API_KEY")
        .or_else(|_| env::var("NEXT_PUBLIC_GROQ_API_KEY"))
        .unwrap_or_default();

    let store = get_vector_store(&app)?;
    let search_engine = VectorSearchEngine::new(store.clone());
    let context = search_engine.get_context_for_query(&message, 3);
    let rag_docs: Vec<Document> = search_engine
        .search(&message, 5)
        .unwrap_or_default()
        .into_iter()
        .map(|r| r.document)
        .collect();

    let groq_available = !groq_key.is_empty() && groq_key != "votre_cle_groq_ici";
    if !groq_available {
        eprintln!("⚠️ [NATIVE_GROQ] Clé Groq absente — génération 100% locale (modèle léger RAG).");
        return Ok(offline_generate(&rag_docs, &message));
    }

    let timestamp = chrono::Local::now().format("%H:%M:%S").to_string();
    eprintln!("🚀 [{}] [NATIVE_GROQ] Traitement de la commande LPU...", timestamp);

    let system_content = if context.is_empty() {
        "Vous êtes VisioNode Core (Natif), l'IA de contrôle industriel CCP. Réponses techniques en français.".to_string()
    } else {
        format!("Vous êtes VisioNode Core (Natif), l'IA de contrôle industriel CCP. Réponses techniques en français.\n\nCONTEXTE RÉCUPÉRÉ:\n{}", context)
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(GROQ_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("ERREUR_CLIENT_HTTP : {}", e))?;

    let mut messages = vec![
        serde_json::json!({
            "role": "system",
            "content": system_content
        })
    ];

    for h in history {
        let mapped_role = match h.role.as_str() {
            "model" => "assistant",
            "assistant" => "assistant",
            "user" => "user",
            "system" => "system",
            _other => "user",
        };
        messages.push(serde_json::json!({
            "role": mapped_role,
            "content": h.content
        }));
    }
    messages.push(serde_json::json!({"role": "user", "content": message}));

    match call_groq_with_retry(client, &groq_key, messages).await {
        Ok(output) => {
            eprintln!("✅ [{}] [SUCCÈS] Réponse générée par Groq Natif (avec RAG local).", timestamp);
            Ok(ChatOutput {
                text: output.text,
                provider: format!("{} + RAG Local", output.provider),
            })
        },
        Err(e) => {
            eprintln!("❌ [{}] [ERREUR] {}", timestamp, e);
            Err(e)
        }
    }
}

#[tauri::command]
fn search_documents(app: tauri::AppHandle, query: String, top_k: Option<usize>) -> Result<SearchOutput, String> {
    let store = get_vector_store(&app)?;
    let engine = VectorSearchEngine::new(store);
    let results = engine.search(&query, top_k.unwrap_or(10))?;

    let items: Vec<SearchResultItem> = results.into_iter().map(|r| {
        SearchResultItem {
            id: r.document.id,
            content: r.document.content,
            score: r.score,
            metadata: SearchMetadata {
                origin: r.document.metadata.origin,
                file_name: r.document.metadata.file_name,
                parent_dir: r.document.metadata.parent_dir,
                file_path: r.document.metadata.file_path,
            },
        }
    }).collect();

    Ok(SearchOutput {
        total: items.len(),
        results: items,
    })
}

#[tauri::command]
fn get_vector_stats(app: tauri::AppHandle) -> Result<IndexStatsOutput, String> {
    let store = get_vector_store(&app)?;
    let stats = store.get_stats().map_err(|e| e.to_string())?;
    Ok(IndexStatsOutput {
        total_documents: stats.total_documents,
        total_chunks: stats.total_chunks,
        vocabulary_size: stats.vocabulary_size,
        embedding_dimensions: stats.embedding_dimensions,
    })
}

#[tauri::command]
fn clear_vector_index(app: tauri::AppHandle) -> Result<(), String> {
    let store = get_vector_store(&app)?;
    store.clear().map_err(|e| e.to_string())?;
    store.reset_vocab();
    Ok(())
}

fn init_vector_store(app: &tauri::App) -> Result<Arc<VectorStore>, String> {
    // On stocke vectors.db AU MÊME endroit que le `.local-db` résolu pour
    // l'indexation (resolve_local_db_root), afin d'éviter la divergence entre
    // l'emplacement de scan (cwd de l'EXE) et celui de la DB d'embeddings
    // (app_data_dir) en mode hybride / packaging EXE.
    let db_root = resolve_local_db_root(app);
    std::fs::create_dir_all(&db_root).ok();
    let vector_path = db_root.join("vectors");

    // Dimensions TF-IDF du store Rust (SQLite). NB : indépendant du store JS
    // embarqué (embedded-vector-store.ts, 384 dims bag-of-words hashé) — les deux
    // moteurs ne partagent PAS d'embeddings binaires, chacun ré-indexe son corpus.
    const RUST_TFIDF_DIMENSIONS: usize = 256;
    let store = VectorStore::new(vector_path, RUST_TFIDF_DIMENSIONS)
        .map_err(|e| format!("Failed to initialize vector store: {}", e))?;

    store.load_vocabulary()
        .map_err(|e| format!("Failed to load vocabulary: {}", e))?;

    Ok(Arc::new(store))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(
            Builder::default()
                .add_migrations(LOCAL_DB_URL, local_migrations())
                .build(),
        )
        .setup(|app| {
            let store = init_vector_store(app)?;
            let store_for_index = store.clone();
            app.manage(store);
            eprintln!("✅ [VECTOR_STORE] Initialisé (dim=256, SQLite local)");

            let db_root = resolve_local_db_root(app);

            tauri::async_runtime::spawn_blocking(move || {
                if !db_root.exists() {
                    eprintln!("[INDEX_AUTO] Répertoire {} absent, indexation ignorée.", db_root.display());
                    return;
                }

                eprintln!("[INDEX_AUTO] Indexation automatique de {}...", db_root.display());
                let indexer = DocumentIndexer::new(store_for_index, db_root.to_string_lossy().to_string());

                match indexer.index_local_db() {
                    Ok(stats) => {
                        eprintln!("[INDEX_AUTO] Indexation terminée: {} docs, {} chunks, {} termes",
                            stats.total_documents, stats.total_chunks, stats.vocabulary_size);
                    }
                    Err(e) => {
                        eprintln!("[INDEX_AUTO] Erreur indexation: {}", e);
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            chat_with_ia,
            index_local_db,
            search_documents,
            get_vector_stats,
            clear_vector_index,
            get_local_db_root
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
