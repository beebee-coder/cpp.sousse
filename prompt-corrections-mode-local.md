# Prompt : Corrections stabilité Mode Local (offline) — Private/Secure

Tu es un ingénieur software sur le projet VisioNode. Corrige les erreurs suivantes dans l’ordre de priorité. Pour chaque erreur, indique le fichier cible, la ligne approximative, et applique le correctif décrit.

---

## P0 — CRITIQUE (corriger en premier)

### 1. RAG offline vide : `offline_generator.rs` reçoit `&[]`

**Fichier** : `src-tauri/src/main.rs:186-191`, `src-tauri/src/offline_generator.rs:7-10`

**Problème** : `chat_with_ia` appelle `offline_generate(&message)` sans passer les documents indexés localement. Le RAG offline est donc factice : il ne retourne que l’intro/outro sans contenu.

**Correction** :
- Modifier la signature de `OfflineGenerator::generate` pour accepter un slice de documents (`&[Document]`).
- Dans `chat_with_ia`, avant d’appeler `offline_generate`, interroger le vector store local (Chroma embedded ou SQLite full-text) pour récupérer les chunks pertinents correspondant au `message`.
- Passer ces documents à `offline_generate`.
- Si aucun document n’est trouvé, conserver le comportement actuel (réponse sans contexte).

---

### 2. Race condition manifest JS ↔ Rust

**Fichier** : `src-tauri/src/local_db.rs:332-398` (fonction `local_db_inject`), `src/lib/db/local-db.ts:122-146` (`withManifestLock`)

**Problème** : Le verrou `SharedArrayBuffer`/`Atomics` n’existe que côté JS. Les commandes Rust écrivent le manifest sans verrou, donc un appel Tauri concurrent peut écraser les modifications JS.

**Correction** :
- Ajouter un advisory lock fichier (`local-db/.manifest.lock`) côté Rust, identique à celui déjà existant dans `embedded-vector-store.ts:242-263`.
- Utiliser `fs::OpenOptions` avec création exclusive (WX) et attente bornée.
- Toutes les fonctions Rust qui modifient le manifest (`local_db_inject`, `local_db_delete`, `local_db_rename`) doivent acquérir ce verrou avant `load_manifest`/`save_manifest`.

---

## P1 — ÉLEVÉ

### 3. Perte silencieuse de vecteurs en multi-tab

**Fichier** : `src/lib/embedded-vector-store.ts:210-230` (`mergeFromDisk`)

**Problème** : `_store` est chargé une fois en mémoire par tab. Si deux tabs indexent simultanément, le second ne merge que les documents absents, pas les documents modifiés. Les vecteurs du premier tab sont écrasés.

**Correction** :
- Remplacer le merge "absent only" par un merge last-write-wins : comparer `lastAccess` ou ajouter un champ `updatedAt` dans `StoredDoc`.
- Si le document existe déjà en mémoire et sur disque, conserver la version la plus récente.

---

### 4. Trust session quand SQLite corrompu

**Fichier** : `src/lib/local-sql.ts:209-213`

**Problème** : `validateLocalSession` renvoie un user fictif (`role: 'user', approved: true`) si SQLite est indisponible. Cela permet de continuer offline mais désactive toute révocation effective.

**Correction** :
- Supprimer le trust fallback. Si `db` est null, retourner `null` (déconnexion).
- Ajouter un indicateur visuel "Mode dégradé — base locale indisponible" pour expliquer à l’utilisateur pourquoi il est déconnecté.

---

## P2 — MOYEN

### 5. Sanitize paths côté Rust

**Fichier** : `src-tauri/src/local_db.rs:244-261` (`local_db_read`), `local_db_write:264-273`, `local_db_delete:276-292`, `local_db_rename:295-320`, `local_db_create_folder:323-329`, `local_db_inject:332-398`

**Problème** : Aucune validation de `rel_path` contre `..` ou chemins absolus. Un chemin malicieux peut écrire hors de `.local-db/`.

**Correction** :
- Ajouter une fonction `sanitize_rel_path(rel_path: &str) -> Result<String, String>` qui :
  - Rejette tout chemin contenant `..`
  - Rejette les chemins absolus (commençant par `/` ou `\\`)
  - Normalise les slashes
- L’appeler en début de chaque commande Tauri avant `root.join(&rel_path)`.

---

### 6. Ré-indexation inutile en mode local

**Fichier** : `src/lib/db/sync-engine.ts:262-303` (`syncAll`)

**Problème** : `syncAll` appelle `vectorizeLocalItems` même en mode local, mais cette fonction n’a pas de garde `localOnly`. Elle re-indexe tout à chaque sync.

**Correction** :
- Ajouter un check `localOnly` au début de `syncAll` pour sauter la phase de vectorisation si en mode local pur.
- Ou modifier `vectorizeLocalItems` pour retourner `{ success: true, indexed: 0 }` si `localOnly`.

---

## P3 — FAIBLE

### 7. Timeout Tauri explicite

**Fichier** : `src/lib/local-db-bridge.ts:49-55`

**Problème** : Les commandes Tauri n’ont pas de timeout. Si le FS est bloqué, l’invocation JS hang indéfiniment.

**Correction** :
- Wrapper `invoke()` avec `Promise.race` et un timeout de 30s.
- Retourner une erreur `TAURI_INVOKE_TIMEOUT` si dépassé.

---

### 8. Notification UI pour LRU eviction

**Fichier** : `src/lib/embedded-vector-store.ts:147-149`

**Problème** : LRU à 50k/50Mo évince sans notification UI. L’utilisateur ne sait pas que des vecteurs ont disparu.

**Correction** :
- Exposer `getLastEvictionCount()` dans le hook ou le store Zustand global.
- Afficher un toast/badge quand `evicted > 0` après une opération d’indexation.

---

## Ordre d’exécution suggéré

1. **R14** — Chat offline RAG (P0)
2. **R1** — Race condition manifest (P0)
3. **R8** — Merge vectors multi-tab (P1)
4. **R5** — Trust session SQLite corrupt (P1)
5. **R16** — Path sanitize Rust (P2)
6. **R12** — Ré-indexation locale (P2)
7. **R17** — Timeout Tauri (P3)
8. **R11** — Notification LRU (P3)

---

## Validation

Après chaque correctif :
- Lancer `npx vitest run src/lib/db/__tests__/local-db.test.ts` (tests existants).
- Ajouter un test unitaire pour chaque nouveau comportement (ex: path sanitize Rust, merge vectors).
- Vérifier en mode desktop Tauri que le mode local fonctionne sans réseau.
