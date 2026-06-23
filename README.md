
# VisioNode Control Center | CCP Industrial Vision

Plateforme de contrôle par vision industrielle hybride avec audit de flux intelligent.

## 🏗️ Architecture Structurelle (`src/`)

L'application suit une architecture modulaire conçue pour l'hybridation Web/Desktop et la haute performance IA.

```text
src/
├── ai/                         # Cerveau du système (Logique IA)
│   ├── flows/                  # Flux de travail Genkit / Groq
│   │   ├── dynamic-chat-flow.ts       # Chat neural avec RAG
│   │   ├── vision-assistant-description.ts # Analyse visuelle
│   │   └── visual-document-retrieval.ts   # RAG basé image
│   └── dev.ts                  # Point d'entrée AI Dev
├── app/                        # Moteur Next.js (App Router)
│   ├── (dashboard)/            # Routes de l'interface
│   │   ├── bdd/page.tsx               # Explorateur de base
│   │   ├── chat/page.tsx              # Chat neural
│   │   ├── dashboard/page.tsx         # Moniteur système
│   │   ├── dataset/page.tsx           # Entraînement RAG & Voix
│   │   └── pipeline/page.tsx          # Pilotage Forge
│   ├── api/                    # Points de terminaison
│   │   ├── chat/route.ts              # Proxy Chat IA
│   │   ├── sync/                      # Endpoints Sync Neon
│   │   ├── vector/                    # Gestion Chroma/Weaviate
│   │   └── vision/                    # Analyse visuelle
│   ├── globals.css             # Thème industriel
│   └── layout.tsx              # Structure racine
├── components/                 # Composants React
│   ├── dashboard/              # Composants cockpit
│   │   ├── Sidebar.tsx                # Navigation latérale
│   │   ├── VisionTerminal.tsx         # Analyse en direct
│   │   └── SyncPanel.tsx              # Panneau de Sync
│   ├── ui/                     # ShadCN UI
│   └── PlatformProvider.tsx    # Pont Web vs Natif
├── hooks/                      # Logique d'état
│   ├── use-chat.ts             # Dialogue IA
│   ├── use-voice.ts            # Moteur Speech-to-Text Atomic
│   └── use-sync.ts             # Orchestrateur Sync
├── lib/                        # Bibliothèque centrale
│   ├── db/                     # Clients persistence
│   │   ├── sync-engine.ts             # Moteur de transfert
│   │   ├── postgres-client.ts         # Liaison Neon
│   │   └── chroma-client.ts           # Moteur vectoriel
│   ├── chroma.ts               # Config ChromaDB
│   ├── platform.ts             # Détection Web/Tauri
│   └── api-client.ts           # Client API Audité
└── types/                      # Définitions globales
```

---
*Propriété technique de CCP Industrial Vision.*
