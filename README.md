
# VisioNode Control Center | CCP Industrial Vision

Plateforme de contrôle par vision industrielle hybride avec audit de flux intelligent.

## 🚀 Guide d'Installation Desktop (Windows)

### 1. Installation de l'application
1. Téléchargez et exécutez `VisioNode_Setup_x64.exe`.
2. Suivez les instructions de l'installateur. Une icône sera créée sur votre bureau.

### 2. Configuration des liaisons (Premier lancement)
L'application nécessite des clés API pour communiquer avec les services d'IA et de synchronisation.
1. Ouvrez le dossier d'installation (généralement `C:\Program Files\VisioNode`).
2. Localisez le fichier `.env.example`.
3. Editez le nouveau fichier `.env` avec vos clés API (Groq, Weaviate, GitHub).
4. Relancez l'application.

---

## 🏗️ Architecture Structurelle (`src/`)

L'application suit une architecture modulaire conçue pour l'hybridation Web/Desktop et la haute performance IA.

```text
src/
├── ai/                         # Cerveau du système (Logique IA)
│   ├── flows/                  # Flux de travail Genkit / Groq
│   │   ├── dynamic-chat-flow.ts       # Chat neural avec RAG multi-collection
│   │   ├── vision-assistant-description.ts # Analyse visuelle industrielle
│   │   └── visual-document-retrieval.ts   # RAG basé sur l'image
│   └── dev.ts                  # Point d'entrée AI pour le développement
├── app/                        # Moteur Next.js (App Router)
│   ├── (dashboard)/            # Routes de l'interface de contrôle
│   │   ├── bdd/page.tsx               # Explorateur de base de données hybride
│   │   ├── chat/page.tsx              # Interface de dialogue neural
│   │   ├── dashboard/page.tsx         # Moniteur système et cockpit visuel
│   │   ├── dataset/page.tsx           # Entraînement RAG et saisie vocale
│   │   └── pipeline/page.tsx          # Pilotage du flux industriel (Forge)
│   ├── api/                    # Points de terminaison (Hybrid Routes)
│   │   ├── chat/route.ts              # Proxy de chat IA
│   │   ├── sync/                      # Endpoints de synchronisation Neon
│   │   ├── vector/                    # Gestion des collections Chroma/Weaviate
│   │   └── vision/                    # Analyse et récupération documentaire
│   ├── globals.css             # Thème industriel (Tailwind + CSS Var)
│   └── layout.tsx              # Structure racine et injection de contexte
├── components/                 # Composants React réutilisables
│   ├── dashboard/              # Composants métier du cockpit
│   │   ├── Sidebar.tsx                # Navigation latérale intelligente
│   │   ├── VisionTerminal.tsx         # Terminal d'analyse visuelle en direct
│   │   ├── SyncPanel.tsx              # Panneau de contrôle de synchronisation
│   │   └── CommandPalette.tsx         # Barre de commande rapide (/)
│   ├── ui/                     # Composants atomiques ShadCN
│   └── PlatformProvider.tsx    # Détection et gestion du mode Web vs Natif
├── hooks/                      # Logique d'état et hooks personnalisés
│   ├── use-chat.ts             # Gestion du dialogue neural (Web/Tauri)
│   ├── use-voice.ts            # Moteur Speech-to-Text (Atomic-to-Ref)
│   ├── use-sync.ts             # Orchestrateur de synchronisation Cloud/Local
│   └── use-toast.ts            # Notifications d'audit système
├── lib/                        # Bibliothèque logicielle centrale
│   ├── db/                     # Clients de persistence (Neon, SQLite, Sync)
│   │   ├── sync-engine.ts             # Moteur de transfert atomique
│   │   ├── postgres-client.ts         # Liaison Neon Postgres
│   │   └── chroma-client.ts           # Interface moteur vectoriel
│   ├── chroma.ts               # Configuration ChromaDB et Embeddings
│   ├── weaviate-client.ts      # Liaison avec le registre cloud
│   ├── platform.ts             # Pont de détection Web / Tauri
│   └── api-client.ts           # Client API unifié avec audit iconographié
└── types/                      # Définitions TypeScript globales
```

---

## 🛠️ Guide de "Forge" (Pour Développeurs)

La Forge transforme le code Next.js en binaire natif Windows hautement optimisé.

### A. Pipeline de Transformation Rapide
Utilisez les scripts à la racine pour automatiser le processus :
- `./forge-desktop.sh` : Nettoyage, compilation Next.js statique et forge du binaire Tauri.
- `./sync.sh` : Synchronisation du registre local avec le dépôt GitHub central.

### B. Détails Techniques
- **Pont Natif (Tauri Bridge)** : En mode Desktop, l'IA utilise un moteur Rust natif pour lire les clés `.env` et accéder aux ressources locales.
- **Audit de Flux** : Journalisation structurée (`[VOICE_HOOK]`, `[DATASET_AUDIT]`) pour une traçabilité industrielle totale.
- **Hybridation** : Utilisation d'API Routes Next.js pour conserver la connectivité web tout en restant compatible avec l'export statique (EXE).

---
*Propriété technique de CCP Industrial Vision. Déploiement optimisé pour Vercel et stations locales.*
