
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
3. Exécutez le script `configure-app.ps1` (Clic droit > Exécuter avec PowerShell).
4. Éditez le nouveau fichier `.env` avec vos clés API (Groq, Gemini, GitHub).
5. Relancez l'application.

---

## 🏗️ Architecture Structurelle (`src/`)

L'application suit une architecture modulaire conçue pour l'hybridation Web/Desktop et la haute performance IA.

```text
src/
├── ai/                     # Cerveau du système
│   ├── flows/              # Flux logiques IA (Analyse visuelle, RAG, Chat)
│   └── dev.ts              # Point d'entrée pour l'environnement de développement
├── app/                    # Moteur Next.js (App Router)
│   ├── (dashboard)/        # Routes de l'interface de contrôle (BDD, Chat, Dataset)
│   ├── api/                # Points de terminaison hybrides (Vision, Vector, Sync)
│   ├── actions/            # Server Actions pour le pilotage du pipeline
│   ├── globals.css         # Thème industriel (Tailwind + CSS Variables)
│   └── layout.tsx          # Structure racine et injection du PlatformProvider
├── components/             # Composants React réutilisables
│   ├── dashboard/          # Composants métier (Terminal de vision, Sidebar, Sync)
│   ├── ui/                 # Composants atomiques ShadCN (Boutons, Cards, Dialogs)
│   └── PlatformProvider.tsx # Gestionnaire de contexte de plateforme (Web vs Natif)
├── hooks/                  # Logique d'état personnalisée
│   ├── use-chat.ts         # Gestion du dialogue neural
│   ├── use-voice.ts        # Moteur Speech-to-Text & Text-to-Speech
│   ├── use-sync.ts         # Orchestrateur de synchronisation Cloud/Local
│   └── use-toast.ts        # Système de notifications d'audit
├── lib/                    # Bibliothèque logicielle centrale
│   ├── db/                 # Clients de base de données (Postgres, SQLite, Sync Engine)
│   ├── chroma.ts           # Interface avec le moteur vectoriel local
│   ├── weaviate-client.ts  # Liaison avec le registre sémantique cloud
│   ├── platform.ts         # Pont de détection Web / Tauri Natif
│   └── api-client.ts       # Client API unifié avec gestion de timeout
└── types/                  # Définitions TypeScript globales
```

---

## 🛠️ Guide de "Forge" (Pour Développeurs)

La Forge transforme le code Next.js en binaire natif Windows hautement optimisé.

### A. Personnalisation des Icônes
Pour changer l'icône de l'application EXE/MSI :
1. Remplacez les fichiers dans `src-tauri/icons/` par vos propres icônes.
2. Formats requis : `icon.ico` (Windows), `icon.png` (512x512) et les variantes de taille (32x32, 128x128).

### B. Pipeline de Transformation Rapide
Utilisez les scripts PowerShell à la racine pour automatiser le processus :
- `.\update-and-build.ps1` : Nettoyage complet, mise à jour et forge du binaire.
- `.\quick-update.ps1` : Synchronisation rapide vers GitHub/Vercel.
- `.\tag-and-release.ps1` : Création de version et déclenchement du pipeline GitHub Actions.

### C. Détails Techniques
- **Pont Natif (Tauri Bridge)** : En mode Desktop, l'IA utilise un moteur Rust natif pour lire les clés `.env` locales.
- **Priorité IA** : Routage automatique vers le moteur **Groq LPU** (Llama 3.3).
- **Audit de Flux** : Journalisation iconographiée (🚀, ⚡, ✅) pour une traçabilité industrielle.
- **Hybridation** : Utilisation d'API Routes Next.js pour conserver la connectivité web tout en restant compatible avec l'export statique.

---
*Propriété technique de CCP Industrial Vision. Déploiement optimisé pour Vercel et stations locales.*
