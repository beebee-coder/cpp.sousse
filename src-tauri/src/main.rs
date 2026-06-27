// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::env;
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

use tauri::Manager;

#[tauri::command]
async fn chat_with_ia(
    app: tauri::AppHandle,
    message: String,
    history: Vec<ChatMessage>
) -> Result<ChatOutput, String> {
    // 1. Essayer de charger le .env dans le dossier de l'exécutable (priorité utilisateur)
    if let Ok(exe_path) = env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let env_exe = exe_dir.join(".env");
            if env_exe.exists() {
                let _ = dotenvy::from_path(&env_exe);
            }
        }
    }

    // 2. Essayer de charger le .env depuis les ressources de l'application installée (supporte ../.env empaqueté en _up_/.env ou .env)
    for rel_path in &["_up_/.env", ".env"] {
        if let Ok(resource_path) = app.path().resolve(rel_path, tauri::path::BaseDirectory::Resource) {
            let resource_path: std::path::PathBuf = resource_path;
            if resource_path.exists() {
                let _ = dotenvy::from_path(&resource_path);
                break;
            }
        }
    }

    // 3. Charger le .env local (répertoire courant)
    let _ = dotenv();
    
    let groq_key = env::var("GROQ_API_KEY").or_else(|_| env::var("NEXT_PUBLIC_GROQ_API_KEY")).unwrap_or_default();
    let timestamp = chrono::Local::now().format("%H:%M:%S").to_string();

    if groq_key.is_empty() || groq_key == "votre_cle_groq_ici" {
        return Err("ERREUR_CONFIG : GROQ_API_KEY manquante ou non configurée (contient encore la valeur par défaut 'votre_cle_groq_ici') dans le fichier .env".to_string());
    }

    println!("🚀 [{}] [NATIVE_GROQ] Traitement de la commande LPU...", timestamp);

    let client = reqwest::Client::new();
    
    let mut messages = vec![
        serde_json::json!({
            "role": "system",
            "content": "Vous êtes VisioNode Core (Natif), l'IA de contrôle industriel CCP. Réponses techniques en français."
        })
    ];

    for h in history {
        messages.push(serde_json::json!({
            "role": if h.role == "model" { "assistant" } else { "user" },
            "content": h.content
        }));
    }
    messages.push(serde_json::json!({"role": "user", "content": message}));

    let res = client.post("https://api.groq.com/openai/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", groq_key))
        .json(&serde_json::json!({
            "model": "llama-3.3-70b-versatile",
            "messages": messages,
            "temperature": 0.1
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
                    println!("✅ [{}] [SUCCÈS] Réponse générée par Groq Natif.", timestamp);
                    return Ok(ChatOutput {
                        text: text.to_string(),
                        provider: "GROQ/LLAMA-3.3 (NATIF)".to_string(),
                    });
                }
            }
            Err("ERREUR_REPONSE : Format de réponse invalide.".to_string())
        },
        Err(e) => Err(format!("ERREUR_RESEAU : {}", e))
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![chat_with_ia])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
