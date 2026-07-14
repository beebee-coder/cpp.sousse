// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::env;
use std::sync::Arc;
use dotenvy::dotenv;

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
use vector_store::{VectorStore, DocumentIndexer};
use vector_store::search::VectorSearchEngine;

const LOCAL_DB_URL: &str = "sqlite:visionode.sqlite";
const GROQ_TIMEOUT_SECS: u64 = 30;
const GROQ_RETRIES: u32 = 2;
const GROQ_RETRY_DELAY_MS: u64 = 1000;
const VECTOR_DB_PATH: &str = ".local-db/vectors";
const LOCAL_DB_ROOT: &str = ".local-db";

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
                let is_retryable = last_error.contains("429")
                    || last_error.contains("500")
                    || last_error.contains("timeout")
                    || last_error.contains("network");

                if attempt < GROQ_RETRIES && is_retryable {
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
            if !status.is_success() {
                let err_text = response.text().await.unwrap_or_default();
                return Err(format!("ERREUR_API_GROQ (HTTP {}): {}", status, err_text));
            }
            if let Ok(json) = response.json::<serde_json::Value>().await {
                if let Some(text) = json["choices"][0]["message"]["content"].as_str() {
                    eprintln!("✅ [NATIVE_GROQ] Réponse générée.");
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

    if groq_key.is_empty() || groq_key == "votre_cle_groq_ici" {
        return Err("ERREUR_CONFIG : GROQ_API_KEY manquante ou invalide".to_string());
    }

    let timestamp = chrono::Local::now().format("%H:%M:%S").to_string();
    eprintln!("🚀 [{}] [NATIVE_GROQ] Traitement de la commande LPU...", timestamp);

    let store = get_vector_store(&app)?;
    let search_engine = VectorSearchEngine::new(store.clone());

    let context = search_engine.get_context_for_query(&message, 3);
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
        messages.push(serde_json::json!({
            "role": if h.role == "model" { "assistant" } else { "user" },
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
fn index_local_db(app: tauri::AppHandle) -> Result<IndexStatsOutput, String> {
    let store = get_vector_store(&app)?;
    let indexer = DocumentIndexer::new(store, LOCAL_DB_ROOT.to_string());
    let stats = indexer.index_local_db()?;
    Ok(IndexStatsOutput {
        total_documents: stats.total_documents,
        total_chunks: stats.total_chunks,
        vocabulary_size: stats.vocabulary_size,
        embedding_dimensions: stats.embedding_dimensions,
    })
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
    let stats = store.get_stats();
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
    store.clear().map_err(|e| e.to_string())
}

fn init_vector_store(app: &tauri::App) -> Result<Arc<VectorStore>, String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let vector_path = app_data_dir.join(VECTOR_DB_PATH);

    let store = VectorStore::new(vector_path, 256)
        .map_err(|e| format!("Failed to initialize vector store: {}", e))?;

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
            app.manage(store);
            eprintln!("✅ [VECTOR_STORE] Initialisé (dim=256, SQLite local)");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            chat_with_ia,
            index_local_db,
            search_documents,
            get_vector_stats,
            clear_vector_index
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
