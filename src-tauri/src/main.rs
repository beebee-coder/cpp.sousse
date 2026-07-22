// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::env;
use dotenvy::dotenv;
use reqwest::StatusCode;
use tauri::Emitter;

#[derive(Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ChatOutput {
  pub text: String,
  pub provider: String,
  pub groq_available: bool,
}

#[derive(Serialize, Deserialize)]
pub struct ToolCall {
    pub tool: String,
    pub params: serde_json::Value,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct StreamChunk {
  pub chunk: String,
  pub done: bool,
  pub result: Option<ChatOutput>,
}

use tauri::Manager;
use tauri_plugin_sql::{Builder, Migration, MigrationKind};

mod vector_store;
mod offline_generator;
mod local_db;

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
    resolve_root_inner(app, LOCAL_DB_ROOT)
}

/// R1 — Résout le répertoire `.registry` PHYSIQUE avec EXACTEMENT la même
/// stratégie racine que `.local-db`. Sans ça, si `.local-db` est résolu via
/// `app_data_dir`, l'ancien code (`resolve_local_db_root().parent()`) pointait
/// le `.registry` dans le mauvais répertoire parent → divergence entre l'écriture
/// JS (`process.cwd()/.registry`) et la lecture Rust (tools natifs). On cherche
/// donc `.registry` au même niveau que `.local-db`, jamais via un `parent()` aveugle.
fn resolve_registry_root<T: tauri::Manager<tauri::Wry>>(app: &T) -> std::path::PathBuf {
    resolve_root_inner(app, ".registry")
}

fn resolve_root_inner<T: tauri::Manager<tauri::Wry>>(app: &T, leaf: &str) -> std::path::PathBuf {
    if let Ok(exe_path) = env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let exe_root = exe_dir.join(leaf);
            if exe_root.exists() {
                return exe_root;
            }
            let mut cur = Some(exe_dir.to_path_buf());
            while let Some(dir) = cur {
                let candidate = dir.join(leaf);
                if candidate.exists() {
                    return candidate;
                }
                cur = dir.parent().map(|p| p.to_path_buf());
            }
        }
    }
    if let Ok(app_data_dir) = app.path().app_data_dir() {
        let data_root = app_data_dir.join(leaf);
        if data_root.exists() {
            return data_root;
        }
    }
    env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join(leaf)))
        .unwrap_or_else(|| std::path::PathBuf::from(leaf))
}

/// Expose la racine `.registry` résolue côté Rust afin que le launcher / serveur
/// Next puisse s'aligner (via REGISTRY_ROOT_OVERRIDE) sur le MÊME répertoire
/// physique que les tools natifs (correction R1).
#[tauri::command]
fn get_registry_root(app: tauri::AppHandle) -> String {
    resolve_registry_root(&app).to_string_lossy().to_string()
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

fn is_retryable_status(status: StatusCode) -> bool {
    status == StatusCode::TOO_MANY_REQUESTS
        || status == StatusCode::INTERNAL_SERVER_ERROR
        || status == StatusCode::BAD_GATEWAY
        || status == StatusCode::SERVICE_UNAVAILABLE
        || status == StatusCode::GATEWAY_TIMEOUT
}

#[tauri::command]
async fn check_network_connectivity() -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .map_err(|e| {
            eprintln!("[NETWORK_CHECK] reqwest build error: {e}");
            e.to_string()
        })?;

    let endpoints = [
        "https://api.groq.com/openai/v1/models",
        "https://www.google.com",
        "https://1.1.1.1",
    ];

    for endpoint in endpoints {
        match client.head(endpoint).send().await {
            Ok(_) => {
                eprintln!("[NETWORK_CHECK] reachable: {endpoint}");
                return Ok(true);
            }
            Err(e) => {
                eprintln!("[NETWORK_CHECK] failed: {endpoint} => {e}");
                continue;
            }
        }
    }

    eprintln!("[NETWORK_CHECK] all endpoints unreachable");
    Ok(false)
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
                         groq_available: true,
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

async fn call_groq_stream(
    client: &reqwest::Client,
    groq_key: &str,
    messages: Vec<serde_json::Value>,
    app: &tauri::AppHandle,
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
            "max_tokens": 300,
            "stream": true
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

            let mut full_text = String::new();
            let mut stream = response.bytes_stream();
            use futures_util::StreamExt;

            while let Some(chunk_result) = stream.next().await {
                match chunk_result {
                    Ok(chunk) => {
                        let text = String::from_utf8_lossy(&chunk);
                        for line in text.lines() {
                            if let Some(data) = line.strip_prefix("data: ") {
                                if data.trim() == "[DONE]" {
                                    continue;
                                }
                                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                                    if let Some(delta) = json["choices"][0]["delta"]["content"].as_str() {
                                        full_text.push_str(delta);
                                        let _ = app.emit("chat-stream-chunk", StreamChunk {
                                            chunk: delta.to_string(),
                                            done: false,
                                            result: None,
                                        });
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        return Err(format!("ERREUR_STREAM: {}", e));
                    }
                }
            }

            let _ = app.emit("chat-stream-chunk", StreamChunk {
                chunk: String::new(),
                done: true,
                result: Some(ChatOutput {
                    text: full_text.clone(),
                    provider: "GROQ/LLAMA-3.3 (NATIF STREAM)".to_string(),
                    groq_available: true,
                }),
            });

            Ok(ChatOutput {
                text: full_text,
                provider: "GROQ/LLAMA-3.3 (NATIF STREAM)".to_string(),
                groq_available: true,
            })
        }
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

fn build_tool_definitions() -> serde_json::Value {
    serde_json::json!([
        {
            "name": "list_procedures",
            "description": "Lister les procédures industrielles disponibles",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": { "type": "string", "description": "Filtrer par catégorie" },
                    "limit": { "type": "number", "description": "Nombre max de résultats" }
                }
            }
        },
        {
            "name": "search_bank",
            "description": "Rechercher dans la banque d'images et vidéos",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Requête de recherche" },
                    "type": { "type": "string", "enum": ["image", "video", "all"] }
                },
                "required": ["query"]
            }
        },
        {
            "name": "search_knowledge",
            "description": "Rechercher dans la base de connaissances",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Requête de recherche" },
                    "category": { "type": "string", "description": "Catégorie" }
                },
                "required": ["query"]
            }
        },
        {
            "name": "analyze_image",
            "description": "Analyser une image industrielle",
            "parameters": {
                "type": "object",
                "properties": {
                    "imageUrl": { "type": "string", "description": "URL de l'image" },
                    "prompt": { "type": "string", "description": "Instruction d'analyse" }
                },
                "required": ["imageUrl"]
            }
        }
    ])
}

fn execute_tool(name: &str, params: &serde_json::Value, app: &tauri::AppHandle) -> Result<String, String> {
    match name {
        "list_procedures" => {
            let registry_dir = resolve_registry_root(app);
            let items_dir = registry_dir.join("items");
            if !items_dir.exists() {
                return Ok("Aucune procédure disponible.".to_string());
            }
            let files = std::fs::read_dir(&items_dir)
                .map_err(|e| e.to_string())?
                .filter_map(|e| e.ok())
                .filter(|e| e.path().extension().map(|ext| ext == "json").unwrap_or(false))
                .collect::<Vec<_>>();

            let limit = params.get("limit").and_then(|v| v.as_u64()).unwrap_or(10) as usize;
            let category_filter = params.get("category").and_then(|v| v.as_str());

            let mut results = Vec::new();
            for file in files.iter().take(limit * 2) {
                if let Ok(content) = std::fs::read_to_string(file.path()) {
                    if let Ok(data) = serde_json::from_str::<serde_json::Value>(&content) {
                        let category = data.get("category").and_then(|v| v.as_str()).unwrap_or("");
                        if let Some(cat) = category_filter {
                            if !category.eq_ignore_ascii_case(cat) {
                                continue;
                            }
                        }
                        let fallback_name = file.file_name().to_str().unwrap_or("").to_string();
                        let title = data.get("title").and_then(|v| v.as_str()).unwrap_or(&fallback_name);
                        let code = data.get("code").and_then(|v| v.as_str()).unwrap_or("");
                        results.push(format!("[{}] {} — {}", code, title, category));
                    }
                }
            }
            Ok(if results.is_empty() {
                "Aucune procédure trouvée.".to_string()
            } else {
                results.join("\n")
            })
        }
        "search_bank" => {
            let query = params.get("query").and_then(|v| v.as_str()).unwrap_or("");
            let registry_dir = resolve_registry_root(app);
            let bank_dir = registry_dir.join("bank");
            if !bank_dir.exists() {
                return Ok("Aucun média disponible.".to_string());
            }
            let folders = std::fs::read_dir(&bank_dir).map_err(|e| e.to_string())?;
            let mut results = Vec::new();
            for folder in folders.filter_map(|e| e.ok()) {
                let meta_path = folder.path().join("metadata.json");
                if let Ok(content) = std::fs::read_to_string(&meta_path) {
                    if let Ok(data) = serde_json::from_str::<serde_json::Value>(&content) {
                        let name = data.get("name").and_then(|v| v.as_str()).unwrap_or("");
                        let desc = data.get("description").and_then(|v| v.as_str()).unwrap_or("");
                        let search_space = format!("{} {}", name, desc).to_lowercase();
                        if search_space.contains(&query.to_lowercase()) || query.is_empty() {
                            let kind = data.get("type").and_then(|v| v.as_str()).unwrap_or("asset");
                            results.push(format!("[{}] {} — {}", kind, name, desc));
                        }
                    }
                }
            }
            Ok(if results.is_empty() {
                "Aucun média trouvé.".to_string()
            } else {
                results.join("\n")
            })
        }
        "search_knowledge" => {
            let query = params.get("query").and_then(|v| v.as_str()).unwrap_or("");
            let registry_dir = resolve_registry_root(app);
            let items_dir = registry_dir.join("items");
            if !items_dir.exists() {
                return Ok("Aucune connaissance disponible.".to_string());
            }
            let files = std::fs::read_dir(&items_dir).map_err(|e| e.to_string())?;
            let mut results = Vec::new();
            for file in files.filter_map(|e| e.ok()).take(20) {
                if let Ok(content) = std::fs::read_to_string(file.path()) {
                    if let Ok(data) = serde_json::from_str::<serde_json::Value>(&content) {
                        let title = data.get("title").and_then(|v| v.as_str()).unwrap_or("");
                        let question = data.get("pairs").and_then(|v| v.as_array()).and_then(|arr| arr.first()).and_then(|v| v.get("question")).and_then(|v| v.as_str()).unwrap_or("");
                        let answer = data.get("pairs").and_then(|v| v.as_array()).and_then(|arr| arr.first()).and_then(|v| v.get("answer")).and_then(|v| v.as_str()).unwrap_or("");
                        let search_space = format!("{} {} {}", title, question, answer).to_lowercase();
                        if search_space.contains(&query.to_lowercase()) || query.is_empty() {
                            let kind = data.get("type").and_then(|v| v.as_str()).unwrap_or("doc");
                            let doc_text = if question.is_empty() { title.to_string() } else { format!("Q: {}\nR: {}", question, answer) };
                            results.push(format!("[{}] {}", kind, doc_text));
                        }
                    }
                }
            }
            Ok(if results.is_empty() {
                "Aucune connaissance trouvée.".to_string()
            } else {
                results.join("\n")
            })
        }
        "analyze_image" => {
            let image_url = params.get("imageUrl").and_then(|v| v.as_str()).unwrap_or("");
            let prompt = params.get("prompt").and_then(|v| v.as_str()).unwrap_or("Analyse industrielle");
            Ok(format!("Analyse visuelle demandée pour: {} avec prompt: {}", image_url, prompt))
        }
        _ => Err(format!("Outil inconnu: {}", name)),
    }
}

/// Réponse 100% locale (sans Groq) : utilise le générateur léger embarqué qui
/// synthétise les passages RAG les plus pertinents. Aucune dépendance réseau.
fn offline_generate(docs: Vec<crate::vector_store::types::Document>, query: &str) -> ChatOutput {
    let text = offline_generator::OfflineGenerator::generate(&docs, query);
    ChatOutput {
        text,
        provider: "VISIONODE_LOCAL (offline, modèle léger RAG)".to_string(),
        groq_available: false,
    }
}

/// Récupère les documents localement indexés pertinents pour la requête.
fn load_offline_documents<T: tauri::Manager<tauri::Wry>>(app: &T, query: &str) -> Vec<crate::vector_store::types::Document> {
    use crate::vector_store::embedding::tokenize_with_stems;

    let root = resolve_local_db_root(app);
    let mirror_path = root.join("chroma-index.json");
    let raw_mirror = match std::fs::read_to_string(&mirror_path) {
        Ok(r) => r,
        Err(_) => return Vec::new(),
    };
    let mirror: serde_json::Value = match serde_json::from_str(&raw_mirror) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    let entries = match mirror.get("entries").and_then(|e| e.as_array()) {
        Some(e) => e,
        None => return Vec::new(),
    };

    let query_tokens: std::collections::HashSet<String> = tokenize_with_stems(query).into_iter().collect();
    if query_tokens.is_empty() {
        return Vec::new();
    }

    const MAX_DOCS: usize = 5;
    const MAX_BYTES: usize = 32_000;
    let mut scored: Vec<(usize, crate::vector_store::types::Document)> = Vec::new();

    for entry in entries {
        let rel_path = match entry.get("relPath").and_then(|v| v.as_str()) {
            Some(p) => p.to_string(),
            None => continue,
        };
        let full = root.join(&rel_path);
        let content = match std::fs::read_to_string(&full) {
            Ok(c) => c,
            Err(_) => continue,
        };
        if content.trim().is_empty() {
            continue;
        }
        let parent_dir = std::path::Path::new(&rel_path)
            .parent()
            .and_then(|p| p.to_str())
            .map(|s| s.to_string());
        let file_name = std::path::Path::new(&rel_path)
            .file_name()
            .and_then(|p| p.to_str())
            .map(|s| s.to_string());

        let ctokens = tokenize_with_stems(&content);
        let overlaps = ctokens.iter().filter(|t| query_tokens.contains(*t)).count();
        if overlaps == 0 {
            continue;
        }

        let snippet = if content.len() > MAX_BYTES {
            content.chars().take(MAX_BYTES).collect::<String>()
        } else {
            content
        };

        // R6 — score lexical (miroir du JS scoreItemAgainstQuery) : pondère par
        // la densité de tokens communs pour trier les docs les plus pertinents
        // en premier, alignant la pertinence Desktop sur le chemin web.
        let score = overlaps * 100 / ctokens.len().max(1);
        scored.push((
            score,
            crate::vector_store::types::Document {
                content: snippet,
                metadata: crate::vector_store::types::DocumentMetadata {
                    parent_dir,
                    file_name,
                    origin: "LOCAL_DB".to_string(),
                },
            },
        ));
    }

    scored.sort_by(|a, b| b.0.cmp(&a.0));
    scored.into_iter().take(MAX_DOCS).map(|(_, d)| d).collect()
}

fn parse_tool_call(text: &str) -> Option<ToolCall> {
    // C3 — tolère le JSON d'appel d'outil n'importe où dans la réponse
    // (texte avant/après), et non plus strictement en début de chaîne.
    // Recherche le premier bloc objet JSON équilibré contenant la clé "tool".
    let start = text.find('{')?;
    let bytes = text.as_bytes();
    let mut depth: i32 = 0;
    let mut in_string = false;
    let mut escape = false;
    let mut end: Option<usize> = None;

    for i in start..text.len() {
        let c = bytes[i] as char;
        if escape {
            escape = false;
            continue;
        }
        if c == '\\' {
            if in_string {
                escape = true;
            }
            continue;
        }
        if c == '"' {
            in_string = !in_string;
            continue;
        }
        if in_string {
            continue;
        }
        if c == '{' {
            depth += 1;
        } else if c == '}' {
            depth -= 1;
            if depth == 0 {
                end = Some(i + 1);
                break;
            }
        }
    }

    let end = end?;
    let slice = &text[start..end];
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(slice) {
        if let Some(tool) = parsed.get("tool").and_then(|v| v.as_str()) {
            return Some(ToolCall {
                tool: tool.to_string(),
                params: parsed.get("params").cloned().unwrap_or(serde_json::Value::Null),
            });
        }
    }
    None
}

#[tauri::command]
async fn chat_with_ia(
    app: tauri::AppHandle,
    message: String,
    history: Vec<ChatMessage>,
    stream: bool,
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

    let tool_definitions = build_tool_definitions();
    let tools_json = serde_json::to_string(&tool_definitions).unwrap_or_default();
    let system_content = format!(
        "Vous êtes VisioNode Core (Natif), l'IA de contrôle industriel CCP. Réponses techniques en français.\n\nOUTILS DISPONIBLES (utilisez le format JSON pour demander leur exécution) :\n{}\n\nRÈGLES D'UTILISATION :\n- Si l'utilisateur demande une action liée à un outil, répondez avec un JSON de la forme : {{\"tool\": \"nom_outil\", \"params\": {{...}}}}\n- Si aucune action n'est requise, répondez normalement en texte.",
        tools_json
    );

    let groq_available = !groq_key.is_empty() && groq_key != "votre_cle_groq_ici";
    if !groq_available {
        eprintln!("⚠️ [NATIVE_GROQ] Clé Groq absente — génération 100% locale (modèle léger RAG).");
        let docs = load_offline_documents(&app, &message);
        return Ok(offline_generate(docs, &message));
    }

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

    let timestamp = chrono::Local::now().format("%H:%M:%S").to_string();

    if stream {
        match call_groq_stream(&client, &groq_key, messages, &app).await {
            Ok(output) => {
                eprintln!("✅ [{}] [SUCCÈS] Réponse générée par Groq Natif (stream).", timestamp);
            Ok(ChatOutput {
                text: output.text,
                provider: format!("{} + RAG Local", output.provider),
                groq_available: true,
            })
            }
            Err(e) => {
                eprintln!("❌ [{}] [ERREUR] {}", timestamp, e);
                Err(e)
            }
        }
    } else {
        match call_groq_with_retry(client, &groq_key, messages).await {
            Ok(mut output) => {
                if let Some(tool_call) = parse_tool_call(&output.text) {
                    eprintln!("🔧 [NATIVE_TOOL] Exécution outil: {}", tool_call.tool);
                    match execute_tool(&tool_call.tool, &tool_call.params, &app) {
                        Ok(tool_result) => {
                            output.text = tool_result;
                            output.provider = format!("{} + OUTIL:{}", output.provider, tool_call.tool);
                        }
                        Err(tool_err) => {
                            output.text = format!("[Outil {}] Erreur: {}", tool_call.tool, tool_err);
                            output.provider = format!("{} + OUTIL:{}", output.provider, tool_call.tool);
                        }
                    }
                }
                eprintln!("✅ [{}] [SUCCÈS] Réponse générée par Groq Natif (avec RAG local).", timestamp);
            Ok(ChatOutput {
                text: output.text,
                provider: format!("{} + RAG Local", output.provider),
                groq_available: true,
            })
            }
            Err(e) => {
                eprintln!("❌ [{}] [ERREUR] {}", timestamp, e);
                Err(e)
            }
        }
    }
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
            #[cfg(desktop)]
            app.handle().plugin(
                tauri_plugin_updater::Builder::new().build()
            )?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_network_connectivity,
            chat_with_ia,
            get_local_db_root,
            get_registry_root,
            local_db::local_db_tree,
            local_db::local_db_read,
            local_db::local_db_write,
            local_db::local_db_delete,
            local_db::local_db_rename,
            local_db::local_db_create_folder,
            local_db::local_db_inject
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
