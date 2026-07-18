use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

const LOCAL_DB_ROOT: &str = ".local-db";
const MANIFEST_FILE: &str = ".local-db-manifest.json";
const MANIFEST_LOCK_FILE: &str = ".manifest.lock";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestEntry {
    pub id: String,
    pub original_name: String,
    pub resolved_path: String,
    pub file_type: String,
    pub knowledge_type: Option<String>,
    pub cloud_id: Option<String>,
    pub timestamp: i64,
    pub size: u64,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub files: Vec<ManifestEntry>,
    pub last_sync: String,
    pub version: String,
    pub seeded_from_registry: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FSNode {
    pub id: String,
    pub name: String,
    pub node_type: String,
    pub size: Option<u64>,
    pub timestamp: Option<i64>,
    pub children: Option<Vec<FSNode>>,
    pub is_open: Option<bool>,
    pub metadata: Option<FSNodeMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FSNodeMetadata {
    pub knowledge_type: Option<String>,
    pub cloud_id: Option<String>,
    pub indexed: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InjectResult {
    pub success: bool,
    pub path: String,
    pub is_duplicate: bool,
}

fn resolve_root(app: &tauri::AppHandle) -> PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let exe_root = exe_dir.join(LOCAL_DB_ROOT);
            if exe_root.exists() {
                return exe_root;
            }
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
    let app_data_dir: PathBuf = match app.path().app_data_dir() {
        Ok(p) => p,
        Err(_) => {
            return std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|d| d.join(LOCAL_DB_ROOT)))
                .unwrap_or_else(|| PathBuf::from(LOCAL_DB_ROOT));
        }
    };
    let data_root = app_data_dir.join(LOCAL_DB_ROOT);
    if data_root.exists() {
        return data_root;
    }
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join(LOCAL_DB_ROOT)))
        .unwrap_or_else(|| PathBuf::from(LOCAL_DB_ROOT))
}

fn manifest_path(root: &Path) -> PathBuf {
    root.join(MANIFEST_FILE)
}

fn load_manifest(root: &Path) -> Manifest {
    let mp = manifest_path(root);
    if !mp.exists() {
        return Manifest {
            files: Vec::new(),
            last_sync: "1970-01-01T00:00:00Z".to_string(),
            version: "1.0.0".to_string(),
            seeded_from_registry: Some(false),
        };
    }
    if let Ok(raw) = fs::read_to_string(&mp) {
        if let Ok(m) = serde_json::from_str::<Manifest>(&raw) {
            return m;
        }
    }
    Manifest {
        files: Vec::new(),
        last_sync: "1970-01-01T00:00:00Z".to_string(),
        version: "1.0.0".to_string(),
        seeded_from_registry: Some(false),
    }
}

fn save_manifest(root: &Path, manifest: &Manifest) {
    let mp = manifest_path(root);
    if let Ok(json) = serde_json::to_string_pretty(manifest) {
        let _ = fs::write(&mp, json);
    }
}

/// Verrou advisory inter-processus (fichier `.manifest.lock`) pour sérialiser
/// les écritures du manifest entre le moteur Rust (Tauri) et le frontend JS
/// (qui utilise son propre `SharedArrayBuffer` en mémoire, inefficace en
/// cross-process). Acquisition exclusive (WX) avec attente bornée (5 s).
fn with_manifest_lock<F, T>(root: &Path, f: F) -> T
where
    F: FnOnce() -> T,
{
    let lock_path = root.join(MANIFEST_LOCK_FILE);
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
    loop {
        match fs::OpenOptions::new().write(true).create_new(true).open(&lock_path) {
            Ok(file) => {
                let _ = file;
                let result = f();
                let _ = fs::remove_file(&lock_path);
                return result;
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                if std::time::Instant::now() >= deadline {
                    // Délai dépassé : on tente quand même (mode dégradé) plutôt que
                    // de perdre la mutation, cohérent avec la couche JS.
                    return f();
                }
                std::thread::sleep(std::time::Duration::from_millis(25));
            }
            Err(_) => return f(),
        }
    }
}

/// Valide et normalise un `rel_path` pour empêcher toute traversée de répertoire
/// (`..`) ou écriture hors de `.local-db` (chemins absolus). Rejette aussi les
/// séparateurs de repertoire Windows bruts.
fn sanitize_rel_path(rel_path: &str) -> Result<String, String> {
    if rel_path.is_empty() {
        return Err("CHEMIN_VIDE".to_string());
    }
    if rel_path.contains("..") {
        return Err("CHEMIN_INVALIDE (.. non autorisé)".to_string());
    }
    let normalized = rel_path.replace('\\', "/");
    if normalized.starts_with('/') || normalized.starts_with("//") {
        return Err("CHEMIN_ABSOLU_NON_AUTORISE".to_string());
    }
    // Rejette les chemins Windows absolus (ex: C: ou \\serveur).
    if normalized.contains(':') || normalized.starts_with("\\\\") {
        return Err("CHEMIN_ABSOLU_NON_AUTORISE".to_string());
    }
    if normalized.contains("..") {
        return Err("CHEMIN_INVALIDE (.. non autorisé)".to_string());
    }
    Ok(normalized)
}

fn generate_id() -> String {
    format!("{}_{}", chrono::Utc::now().timestamp_millis(), uuid::Uuid::new_v4().as_simple())
}

fn ensure_dirs(root: &Path) {
    let _ = fs::create_dir_all(root.join("INDEX_CHROMA"));
    let _ = fs::create_dir_all(root.join("Centrale"));
    let _ = fs::create_dir_all(root.join("Groupes"));
    let _ = fs::create_dir_all(root.join("Alarmes"));
    let _ = fs::create_dir_all(root.join("ressources humaines"));
    let _ = fs::create_dir_all(root.join("ressources humaines/equipes"));
    for eq in ["equipe A", "equipe B", "equipe C", "equipe D"] {
        let _ = fs::create_dir_all(root.join("ressources humaines/equipes").join(eq));
    }
    let _ = fs::create_dir_all(root.join("bank"));
}

/// Charge l'ensemble des `relPath` déjà vectorisés, depuis le miroir
/// `chroma-index.json` (écrit par `local-indexer.ts` côté JS). Permet de
/// marquer `indexed: true` dans l'arbre de l'Explorateur BDD en mode Desktop,
/// exactement comme le fait la couche JS en mode web.
/// Charge l'ensemble des `relPath` déjà vectorisés, depuis le miroir
/// `chroma-index.json` (écrit par `local-indexer.ts` côté JS). Permet de
/// marquer `indexed: true` dans l'arbre de l'Explorateur BDD en mode Desktop,
/// exactement comme le fait la couche JS en mode web.
///
/// R2 — Cohérence racine JS/Rust : le JS écrit `chroma-index.json` sous
/// `process.cwd()/.local-db` (et honore `REGISTRY_ROOT_OVERRIDE`), alors que
/// `resolve_root` Rust résout `.local-db` ascendant depuis l'exe ou via
/// `app_data_dir`. Ces racines DIVERGENT en desktop, ce qui laissait le miroir
/// introuvable et `indexed:false` partout. On lit donc le miroir depuis toutes
/// les racines candidates et on unionne les `relPath`.
fn load_indexed_rel_paths(root: &Path) -> std::collections::HashSet<String> {
    let mut set = std::collections::HashSet::new();
    let mut candidates: Vec<PathBuf> = Vec::new();
    candidates.push(root.to_path_buf());
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join(".local-db"));
    }
    if let Ok(override_val) = std::env::var("REGISTRY_ROOT_OVERRIDE") {
        let trimmed = override_val.trim();
        if !trimmed.is_empty() {
            candidates.push(PathBuf::from(trimmed));
        }
    }
    let exe_root = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()));
    if let Some(er) = exe_root {
        candidates.push(er.join(".local-db"));
    }
    for cand in candidates {
        let mp = cand.join("chroma-index.json");
        if let Ok(raw) = fs::read_to_string(&mp) {
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) {
                if let Some(entries) = value.get("entries").and_then(|e| e.as_array()) {
                    for e in entries {
                        if let Some(rel) = e.get("relPath").and_then(|v| v.as_str()) {
                            set.insert(rel.to_string());
                        }
                    }
                }
            }
        }
    }
    set
}

fn scan_dir_to_tree(dir: &Path, base: &str, manifest: &Manifest, indexed: &std::collections::HashSet<String>) -> Vec<FSNode> {
    let mut nodes = Vec::new();
    if !dir.exists() {
        return nodes;
    }
    let entries = match fs::read_dir(dir) {
        Ok(e) => e.flatten().collect::<Vec<_>>(),
        Err(_) => return nodes,
    };
    for entry in entries {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let rel = if base.is_empty() { name.clone() } else { format!("{}/{}", base, name) };
        if path.is_dir() {
            let children = scan_dir_to_tree(&path, &rel, manifest, indexed);
            nodes.push(FSNode {
                id: rel.clone(),
                name,
                node_type: "folder".to_string(),
                size: None,
                timestamp: path.metadata().ok().and_then(|m| m.modified().ok()).and_then(|t| t.elapsed().ok().map(|d| d.as_millis() as i64)),
                children: Some(children),
                is_open: Some(false),
                metadata: None,
            });
        } else {
            let meta = manifest.files.iter().find(|f| f.resolved_path == rel).cloned();
            nodes.push(FSNode {
                id: rel.clone(),
                name,
                node_type: "file".to_string(),
                size: path.metadata().ok().map(|m| m.len()),
                timestamp: path.metadata().ok().and_then(|m| m.modified().ok()).and_then(|t| t.elapsed().ok().map(|d| d.as_millis() as i64)),
                children: None,
                is_open: None,
                metadata: Some(FSNodeMetadata {
                    knowledge_type: meta.as_ref().and_then(|m| m.knowledge_type.clone()),
                    cloud_id: meta.as_ref().and_then(|m| m.cloud_id.clone()),
                    indexed: Some(indexed.contains(&rel)),
                }),
            });
        }
    }
    nodes.sort_by(|a, b| {
        match (&a.node_type[..], &b.node_type[..]) {
            ("folder", "file") => std::cmp::Ordering::Less,
            ("file", "folder") => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });
    nodes
}

#[tauri::command]
pub fn local_db_tree(app: tauri::AppHandle) -> Result<Vec<FSNode>, String> {
    let root = resolve_root(&app);
    ensure_dirs(&root);
    let manifest = load_manifest(&root);
    let indexed = load_indexed_rel_paths(&root);
    let mut tree = Vec::new();

    for dir_name in ["INDEX_CHROMA", "Centrale", "Groupes", "Alarmes", "ressources humaines", "bank"] {
        let dir_path = root.join(dir_name);
        if dir_path.exists() {
            let children = scan_dir_to_tree(&dir_path, dir_name, &manifest, &indexed);
            tree.push(FSNode {
                id: dir_name.to_string(),
                name: dir_name.to_string(),
                node_type: "folder".to_string(),
                size: None,
                timestamp: None,
                children: Some(children),
                is_open: Some(false),
                metadata: None,
            });
        }
    }
    Ok(tree)
}

#[tauri::command]
pub fn local_db_read(app: tauri::AppHandle, rel_path: String) -> Result<String, String> {
    let safe = sanitize_rel_path(&rel_path)?;
    let root = resolve_root(&app);
    let full = root.join(&safe);
    if !full.exists() {
        return Err("FICHIER_INTROUVABLE".to_string());
    }
    let ext = full.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()).unwrap_or_default();
    if ["jpg", "jpeg", "png", "gif", "mp4", "webm"].contains(&ext.as_str()) {
        let bytes = fs::read(&full).map_err(|e| e.to_string())?;
        let mime = match ext.as_str() {
            "mp4" | "webm" => format!("video/{}", ext),
            _ => format!("image/{}", ext),
        };
        return Ok(format!("data:{};base64,{}", mime, base64_encode(&bytes)));
    }
    fs::read_to_string(&full).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn local_db_write(app: tauri::AppHandle, rel_path: String, content: String) -> Result<(), String> {
    let safe = sanitize_rel_path(&rel_path)?;
    let root = resolve_root(&app);
    ensure_dirs(&root);
    let full = root.join(&safe);
    if let Some(parent) = full.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&full, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn local_db_delete(app: tauri::AppHandle, rel_path: String) -> Result<(), String> {
    let safe = sanitize_rel_path(&rel_path)?;
    let root = resolve_root(&app);
    let full = root.join(&safe);
    if !full.exists() {
        return Err("ELEMENT_INTROUVABLE".to_string());
    }
    if full.is_dir() {
        fs::remove_dir_all(&full).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(&full).map_err(|e| e.to_string())?;
    }
    with_manifest_lock(&root, || {
        let mut manifest = load_manifest(&root);
        let prefix = format!("{}/", rel_path);
        manifest.files.retain(|f| f.resolved_path != rel_path && !f.resolved_path.starts_with(&prefix));
        save_manifest(&root, &manifest);
    });
    Ok(())
}

#[tauri::command]
pub fn local_db_rename(app: tauri::AppHandle, old_path: String, new_name: String) -> Result<(), String> {
    let old_safe = sanitize_rel_path(&old_path)?;
    let new_safe = sanitize_rel_path(&new_name)?;
    let root = resolve_root(&app);
    let old_full = root.join(&old_safe);
    if !old_full.exists() {
        return Err("ELEMENT_INTROUVABLE".to_string());
    }
    let new_full = root.join(&new_safe);
    fs::rename(&old_full, &new_full).map_err(|e| e.to_string())?;
    with_manifest_lock(&root, || {
        let mut manifest = load_manifest(&root);
        let new_rel = path_relative(&root, &new_full).replace("\\", "/");
        let is_dir = new_full.is_dir();
        for entry in &mut manifest.files {
            if is_dir {
                if entry.resolved_path == old_safe || entry.resolved_path.starts_with(&format!("{}/", old_safe)) {
                    entry.resolved_path = entry.resolved_path.replace(&format!("{}/", old_safe), &format!("{}/", new_rel));
                    if entry.resolved_path == old_safe {
                        entry.resolved_path = new_rel.clone();
                    }
                }
            } else if entry.resolved_path == old_safe {
                entry.resolved_path = new_rel.clone();
            }
        }
        save_manifest(&root, &manifest);
    });
    Ok(())
}

#[tauri::command]
pub fn local_db_create_folder(app: tauri::AppHandle, rel_path: String) -> Result<(), String> {
    let safe = sanitize_rel_path(&rel_path)?;
    let root = resolve_root(&app);
    ensure_dirs(&root);
    let full = root.join(&safe);
    fs::create_dir_all(&full).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn local_db_inject(
    app: tauri::AppHandle,
    file_name: String,
    content: String,
    metadata: Option<InjectMetadata>,
    target_dir: Option<String>,
) -> Result<InjectResult, String> {
    let root = resolve_root(&app);
    let safe_name = sanitize_rel_path(&file_name)?;
    let base_dir = if let Some(td) = target_dir {
        let safe_dir = sanitize_rel_path(&td)?;
        if safe_dir.starts_with('/') || safe_dir.starts_with('.') {
            root.join(safe_dir.trim_start_matches('/'))
        } else {
            root.join(safe_dir)
        }
    } else {
        root.join("INDEX_CHROMA")
    };
    let full_base = base_dir.join(&safe_name);

    if !full_base.exists() {
        if let Some(parent) = full_base.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(&full_base, &content).map_err(|e| e.to_string())?;
        let target_path = path_relative(&root, &full_base).replace("\\", "/");
        with_manifest_lock(&root, || {
            let mut manifest = load_manifest(&root);
            manifest.files.push(ManifestEntry {
                id: generate_id(),
                original_name: file_name.clone(),
                resolved_path: target_path.clone(),
                file_type: full_base.extension().and_then(|e| e.to_str()).unwrap_or("unknown").to_string(),
                knowledge_type: metadata.as_ref().and_then(|m| m.knowledge_type.clone()),
                cloud_id: metadata.as_ref().and_then(|m| m.cloud_id.clone()),
                timestamp: chrono::Utc::now().timestamp_millis(),
                size: content.len() as u64,
                tags: metadata.as_ref().and_then(|m| m.tags.clone()),
            });
            save_manifest(&root, &manifest);
        });
        return Ok(InjectResult { success: true, path: target_path, is_duplicate: false });
    }

    let folder_path = base_dir.join(&safe_name);
    if !folder_path.exists() || !folder_path.is_dir() {
        fs::create_dir_all(&folder_path).map_err(|e| e.to_string())?;
    }
    let existing = fs::read_dir(&folder_path).map_err(|e| e.to_string())?;
    let count = existing.filter(|e| e.is_ok()).count();
    let versioned_name = format!("{}_{}", count + 1, safe_name);
    let full_path = folder_path.join(&versioned_name);
    fs::write(&full_path, &content).map_err(|e| e.to_string())?;
    let target_path = path_relative(&root, &full_path).replace("\\", "/");
    with_manifest_lock(&root, || {
        let mut manifest = load_manifest(&root);
        manifest.files.push(ManifestEntry {
            id: generate_id(),
            original_name: file_name.clone(),
            resolved_path: target_path.clone(),
            file_type: full_path.extension().and_then(|e| e.to_str()).unwrap_or("unknown").to_string(),
            knowledge_type: metadata.as_ref().and_then(|m| m.knowledge_type.clone()),
            cloud_id: metadata.as_ref().and_then(|m| m.cloud_id.clone()),
            timestamp: chrono::Utc::now().timestamp_millis(),
            size: content.len() as u64,
            tags: metadata.as_ref().and_then(|m| m.tags.clone()),
        });
        save_manifest(&root, &manifest);
    });
    Ok(InjectResult { success: true, path: target_path, is_duplicate: true })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InjectMetadata {
    pub knowledge_type: Option<String>,
    pub cloud_id: Option<String>,
    pub tags: Option<Vec<String>>,
}

fn path_relative(root: &Path, full: &Path) -> String {
    full.strip_prefix(root).unwrap_or(full).to_string_lossy().replace("\\", "/")
}

fn base64_encode(bytes: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(bytes)
}
