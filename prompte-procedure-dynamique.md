Voici un **prompt complet et structuré** pour que l'IA implante toute la fonctionnalité de procédures industrielles interactives dans votre application :

---

# 🎯 **PROMPT COMPLET POUR L'IA**

---

## 📋 **CONTEXTE GÉNÉRAL**

```
Tu es un expert en développement full-stack spécialisé dans les applications industrielles 4.0 avec intelligence artificielle. 
Tu vas implémenter une fonctionnalité avancée de gestion et d'exécution de procédures industrielles interactives.

L'application existante utilise :
- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- Shadcn UI
- Prisma (PostgreSQL/SQLite)
- ChromaDB (vectoriel)
- NextAuth.js (authentification)
- API Routes (Next.js)

Contexte technique :
- L'application est déjà en production
- Le système RAG est opérationnel
- L'assistant vocal est fonctionnel
- La station de dictée existe
- Le registre physique (.registry/) est actif

Objectif : Implanter un système complet de gestion de procédures industrielles 
qui permet de créer, stocker, exécuter et suivre des procédures complexes 
avec guidage interactif pas-à-pas.
```

---

## 🏗️ **ARCHITECTURE GLOBALE À IMPLANTER**

```
Tu dois implémenter une architecture modulaire complète avec les composants suivants :

1. Modèle de données (Prisma + Types)
2. API Routes (CRUD + Exécution)
3. Services Métier (Moteur d'exécution)
4. UI Dynamique (Formulaire + Visualisation)
5. Assistant Chat (Guidage interactif)
6. Intégration RAG (Recherche sémantique)
7. Système de Monitoring (Statistiques)
8. Exports (PDF, Rapport)
9. Tests unitaires et d'intégration

Structure de dossiers :
src/
├── lib/
│   └── procedures/
│       ├── types/                 # Types et interfaces
│       ├── schemas/               # Schémas JSON de validation
│       ├── services/              # Services métier
│       │   ├── procedure-manager.service.ts
│       │   ├── execution-engine.service.ts
│       │   ├── validator.service.ts
│       │   └── reporting.service.ts
│       ├── assistants/            # Assistants IA
│       │   ├── procedure-assistant.ts
│       │   └── voice-commands.ts
│       └── utils/                 # Utilitaires
│           ├── parser.ts
│           ├── validator.ts
│           └── formatter.ts
├── prisma/
│   └── schema.prisma              # Modèles DB
├── app/
│   ├── api/
│   │   └── procedures/            # API Routes
│   │       ├── route.ts           # GET, POST
│   │       ├── [id]/
│   │       │   └── route.ts       # GET, PUT, DELETE
│   │       ├── execute/
│   │       │   └── route.ts       # POST (exécution)
│   │       ├── validate/
│   │       │   └── route.ts       # POST (validation)
│   │       └── templates/
│   │           └── route.ts       # GET (templates)
│   └── procedures/                # Pages UI
│       ├── page.tsx               # Liste
│       ├── create/
│       │   └── page.tsx           # Création
│       ├── [id]/
│       │   ├── page.tsx           # Détail
│       │   ├── execute/
│       │   │   └── page.tsx       # Exécution
│       │   └── edit/
│       │       └── page.tsx       # Édition
│       └── templates/
│           └── page.tsx           # Templates
├── components/
│   └── procedures/
│       ├── forms/
│       │   ├── DynamicProcedureForm.tsx
│       │   ├── StepEditor.tsx
│       │   └── MetadataEditor.tsx
│       ├── execution/
│       │   ├── ProcedureExecutor.tsx
│       │   ├── StepGuide.tsx
│       │   └── ProgressTracker.tsx
│       ├── visualization/
│       │   ├── ProcedureTimeline.tsx
│       │   ├── StepCard.tsx
│       │   └── StatusDashboard.tsx
│       └── shared/
│           ├── AlarmDisplay.tsx
│           ├── ValidationBadge.tsx
│           └── MediaViewer.tsx
└── hooks/
    ├── useProcedure.ts
    └── useProcedureExecution.ts
```

---

## 📊 **1. MODÈLE DE DONNÉES**

```
Crée un modèle Prisma pour les procédures avec cette structure :

schema.prisma
-------------
model Procedure {
  id              String           @id @default(cuid())
  code            String           @unique
  title           String
  description     String?
  category        ProcedureCategory
  subcategory     String?
  department      Department
  criticality     Criticality
  version         String           @default("1.0.0")
  status          ProcedureStatus  @default(DRAFT)
  
  // Données structurées
  prerequisites   Json             // Liste des prérequis
  steps           Json             // Liste des étapes
                        // 📸 Chaque step peut contenir "mediaRefs": [mediaId,...]
                        //    pour réutiliser les médias capturés/uploadés
  parameters      Json?            // Paramètres configurables
  postExecution   Json?            // Post-exécution
  
  // Métadonnées
  metadata        Json             // Métadonnées complètes
  authorId        String
  author          User             @relation(fields: [authorId], references: [id])
  approvers       Json?            // Liste des approbateurs
  
  // RAG
  embedding       Float[]?         // @db.Vector(384)
  chunks          Json?            // Chunks sémantiques
  
  // Audit
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  lastExecutedAt  DateTime?
  executionCount  Int              @default(0)
  avgDuration     Int?             // Temps moyen d'exécution en secondes
  successRate     Float?           // Taux de succès
  
  // Relations
  executions      ProcedureExecution[]
  alarms          ProcedureAlarm[]
  documents       ProcedureDocument[]
  media           ProcedureMedia[]     // 📸 Médias capturés/uploadés (bibliothèque)
  
  @@index([code])
  @@index([category])
  @@index([status])
}

model ProcedureExecution {
  id              String   @id @default(cuid())
  procedureId     String
  procedure       Procedure @relation(fields: [procedureId], references: [id])
  operatorId      String
  operator        User     @relation(fields: [operatorId], references: [id])
  
  // Exécution
  startTime       DateTime @default(now())
  endTime         DateTime?
  status          ExecutionStatus
  currentStep     Int      @default(-1)
  stepsStatus     Json     // Statut de chaque étape
  totalDuration   Int?     // Durée totale en secondes
  
  // Événements
  events          Json?    // Log des événements
  alarms          Json?    // Alarmes déclenchées
  fallbacks       Json?    // Fallbacks utilisés
  
  // Résultats
  result          Json?    // Résultat final
  notes           String?
  signature       String?  // Signature numérique
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([procedureId])
  @@index([operatorId])
  @@index([status])
}

model ProcedureAlarm {
  id              String   @id @default(cuid())
  procedureId     String
  procedure       Procedure @relation(fields: [procedureId], references: [id])
  code            String
  type            AlarmType
  severity        AlarmSeverity
  description     String
  remedy          Json     // Remède structuré
  condition       String   // Expression de condition
  triggeredAt     DateTime?
  resolvedAt      DateTime?
  status          AlarmStatus @default(ACTIVE)
  
  createdAt       DateTime @default(now())
}

model ProcedureDocument {
  id              String   @id @default(cuid())
  procedureId     String
  procedure       Procedure @relation(fields: [procedureId], references: [id])
  title           String
  type            DocumentType
  url             String
  caption         String?
  uploadedBy      String
  uploadedAt      DateTime @default(now())
}

// 📸 NOUVEAU — Médias capturés/uploadés à la configuration,
// réutilisables dans la séquence de procédure (étape par étape)
model ProcedureMedia {
  id              String   @id @default(cuid())
  procedureId     String
  procedure       Procedure @relation(fields: [procedureId], references: [id])

  kind            MediaKind      // IMAGE | VIDEO
  source          MediaSource    // CAPTURE | UPLOAD
  title           String
  description     String?
  url             String         // URL du fichier (provider de stockage)
  thumbnailUrl    String?        // Miniature (vidéos/aperçu)
  mimeType        String
  fileSize        Int?           // Taille en octets
  duration        Float?         // Durée (vidéos) en secondes
  width           Int?           // Dimensions (optionnel)
  height          Int?

  createdAt       DateTime @default(now())
  createdBy       String

  @@index([procedureId])
}

// Enums
enum ProcedureCategory {
  STARTUP
  SHUTDOWN
  MAINTENANCE
  EMERGENCY
  INSPECTION
  CLEANING
  CALIBRATION
  REPAIR
  OPERATION
  SAFETY
}

enum Department {
  PRODUCTION
  MAINTENANCE
  QUALITY
  SAFETY
  LOGISTICS
}

enum Criticality {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum ProcedureStatus {
  DRAFT
  REVIEW
  APPROVED
  PUBLISHED
  ARCHIVED
  OBSOLETE
}

enum ExecutionStatus {
  IDLE
  PREREQUISITES_CHECK
  RUNNING
  PAUSED
  WAITING_CONFIRMATION
  ALARM
  COMPLETED
  FAILED
  ABORTED
}

enum AlarmType {
  WARNING
  CRITICAL
  INFO
}

enum AlarmSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum AlarmStatus {
  ACTIVE
  RESOLVED
  IGNORED
  ESCALATED
}

enum DocumentType {
  IMAGE
  VIDEO
  DIAGRAM
  PDF
  MODEL
}

// 📸 NOUVEAU — Énumérations pour les médias capturés/uploadés
enum MediaKind {
  IMAGE
  VIDEO
}

enum MediaSource {
  CAPTURE   // capturé via la caméra (photo/vidéo en direct)
  UPLOAD    // téléversé depuis le disque
}
```

---

## 🛠️ **2. SERVICES MÉTIER**

```
Crée les services suivants avec une logique robuste :

A. ProcedureManagerService (lib/procedures/services/procedure-manager.service.ts)
---------------------------------------------------------------
class ProcedureManagerService {
  // CRUD
  async create(data: ProcedureCreateInput): Promise<Procedure>
  async update(id: string, data: ProcedureUpdateInput): Promise<Procedure>
  async delete(id: string): Promise<boolean>
  async get(id: string): Promise<Procedure>
  async list(filters: ProcedureFilters): Promise<Procedure[]>
  
  // Gestion de version
  async createVersion(id: string, changes: string): Promise<Procedure>
  async getHistory(id: string): Promise<ProcedureVersion[]>
  async rollback(id: string, version: string): Promise<Procedure>
  
  // Templates
  async createFromTemplate(templateId: string): Promise<Procedure>
  async saveAsTemplate(id: string): Promise<Template>
  async getTemplates(category?: string): Promise<Template[]>
  
  // Validation
  async validate(data: any): Promise<ValidationResult>
  async checkIntegrity(id: string): Promise<IntegrityCheck>
  
  // Publication
  async publish(id: string): Promise<Procedure>
  async archive(id: string): Promise<Procedure>
  async review(id: string, approverId: string): Promise<Procedure>
}

B. ExecutionEngine (lib/procedures/services/execution-engine.service.ts)
---------------------------------------------------------------
class ExecutionEngine {
  private procedure: Procedure
  private state: ExecutionState
  private listeners: EventListener[]
  
  constructor(procedure: Procedure)
  
  // Contrôle
  async start(): Promise<ExecutionResult>
  async nextStep(): Promise<ExecutionResult>
  async previousStep(): Promise<ExecutionResult>
  async pause(): Promise<void>
  async resume(): Promise<void>
  async abort(): Promise<void>
  async restart(): Promise<void>
  
  // Événements
  on(event: ExecutionEvent, listener: EventListener): void
  emit(event: ExecutionEvent, data: any): void
  
  // État
  getState(): ExecutionState
  getProgress(): Progress
  getCurrentStep(): Step
  getRemainingSteps(): Step[]
  
  // Gestion des erreurs
  async handleAlarm(alarmId: string): Promise<AlarmResolution>
  async executeFallback(stepId: string): Promise<FallbackResult>
  
  // Validation
  async validateStep(step: Step): Promise<ValidationResult>
  async validatePrerequisites(): Promise<PrerequisiteCheck>
  
  // Timing
  startTimer(): void
  pauseTimer(): void
  resumeTimer(): void
  getElapsedTime(): number
}

C. ProcedureValidator (lib/procedures/services/validator.service.ts)
---------------------------------------------------------------
class ProcedureValidator {
  // Validation de structure
  validateStructure(data: any): ValidationResult
  validateSteps(steps: Step[]): ValidationResult
  validateMetadata(metadata: Metadata): ValidationResult
  
  // Validation sémantique
  validateSequencing(steps: Step[]): SequencingValidation
  validateDependencies(steps: Step[]): DependencyValidation
  
  // Validation de cohérence
  checkConsistency(procedure: Procedure): ConsistencyCheck
  checkCompleteness(procedure: Procedure): CompletenessCheck
  
  // Validation des expressions
  validateCondition(condition: string): ConditionValidation
  validateExpressions(procedure: Procedure): ExpressionValidation
  
  // Validation RAG
  validateEmbeddings(procedure: Procedure): EmbeddingValidation
}

D. ReportingService (lib/procedures/services/reporting.service.ts)
---------------------------------------------------------------
class ReportingService {
  // Génération de rapports
  async generateExecutionReport(executionId: string): Promise<Report>
  async generateProcedureReport(procedureId: string): Promise<Report>
  
  // Formats d'export
  async exportToPDF(procedure: Procedure): Promise<Buffer>
  async exportToJSON(procedure: Procedure): Promise<string>
  async exportToMarkdown(procedure: Procedure): Promise<string>
  
  // Statistiques
  async getStatistics(procedureId: string): Promise<Statistics>
  async getAnalytics(filters: AnalyticsFilters): Promise<Analytics>
  
  // Métriques de performance
  async getPerformanceMetrics(procedureId: string): Promise<Metrics>
  async getQualityMetrics(procedureId: string): Promise<QualityMetrics>
}
```

---

## 🤖 **3. ASSISTANT PROCÉDURE**

```
Crée un assistant intelligent qui guide l'opérateur :

A. ProcedureAssistant (lib/procedures/assistants/procedure-assistant.ts)
---------------------------------------------------------------
class ProcedureAssistant {
  private engine: ExecutionEngine
  private chatHistory: ChatMessage[]
  private context: ConversationContext
  
  constructor(procedure: Procedure)
  
  // Interaction
  async processUserQuery(query: string): Promise<AssistantResponse>
  async processVoiceCommand(command: string): Promise<VoiceResponse>
  
  // Commandes
  async handleCommand(command: ProcedureCommand): Promise<CommandResult>
  
  // Intelligence
  async analyzeContext(): Promise<ContextAnalysis>
  async predictNextStep(): Promise<Prediction>
  async suggestAction(): Promise<Suggestion>
  
  // Réponses
  async generateStepResponse(step: Step): Promise<ChatMessage>
  async generateAlarmResponse(alarm: Alarm): Promise<ChatMessage>
  async generateHelpResponse(query: string): Promise<ChatMessage>
  async generateStatusReport(): Promise<StatusReport>
  
  // Proactif
  async checkAlerts(): Promise<Alert[]>
  async suggestOptimizations(): Promise<OptimizationSuggestion[]>
  async identifyRisks(): Promise<RiskAssessment>
}

B. VoiceCommands (lib/procedures/assistants/voice-commands.ts)
---------------------------------------------------------------
const voiceCommands = {
  // Commandes de base
  'démarrer': { action: 'start', description: 'Démarrer la procédure' },
  'suivant': { action: 'next', description: 'Passer à l\'étape suivante' },
  'précédent': { action: 'back', description: 'Revenir à l\'étape précédente' },
  'pause': { action: 'pause', description: 'Mettre en pause' },
  'reprendre': { action: 'resume', description: 'Reprendre l\'exécution' },
  'annuler': { action: 'abort', description: 'Annuler la procédure' },
  'répéter': { action: 'repeat', description: 'Répéter l\'instruction' },
  
  // Commandes avancées
  'statut': { action: 'status', description: 'Afficher le statut' },
  'progression': { action: 'progress', description: 'Afficher la progression' },
  'temps restant': { action: 'remaining', description: 'Temps restant estimé' },
  'aide': { action: 'help', description: 'Afficher l\'aide' },
  'alarme': { action: 'alarm', description: 'Gérer une alarme' },
  'confirmer': { action: 'confirm', description: 'Confirmer une étape' },
  
  // Commandes spécifiques
  'capturer image': { action: 'capture_image', description: 'Capturer une image' },
  'enregistrer vidéo': { action: 'record_video', description: 'Enregistrer une vidéo' },
  'ajouter note': { action: 'add_note', description: 'Ajouter une note' },
  'signer': { action: 'sign', description: 'Signer la procédure' },
  'exporter PDF': { action: 'export_pdf', description: 'Exporter en PDF' },
  
  // Commandes de diagnostic
  'diagnostiquer': { action: 'diagnose', description: 'Diagnostiquer un problème' },
  'vérifier': { action: 'check', description: 'Vérifier une condition' },
  'tester': { action: 'test', description: 'Tester un équipement' },
}
```

---

## 🎨 **4. UI DYNAMIQUE**

```
Crée une interface utilisateur complète et interactive :

A. DynamicProcedureForm (components/procedures/forms/DynamicProcedureForm.tsx)
---------------------------------------------------------------
Caractéristiques :
- Génération automatique du formulaire à partir du JSON Schema
- Validation en temps réel
- Éditeurs spécialisés pour chaque type de donnée
- Drag & drop pour les étapes
- Prévisualisation en direct
- Mode édition/visualisation
- Support des médias (image, vidéo, diagramme)
- Intégration avec l'assistant vocal

📸 NOUVEAU — Bibliothèque de médias capturables/uploadables (ProcedureMediaField)
---------------------------------------------------------------
Lors de la configuration de la procédure, le formulaire expose une section
"Médias de référence" permettant de CAPTURER OU UPLOADER des images et vidéos
qui seront ensuite RÉUTILISABLES dans la séquence de la procédure (à chaque étape) :

- 🎥 Capture directe depuis la caméra (getUserMedia / MediaRecorder) :
    • Photo instantanée (capture d'image via canvas)
    • Enregistrement vidéo (avec durée max config. et aperçu live)
- 📁 Upload depuis le disque (glisser-déposer ou sélecteur de fichier) :
    • Images (jpg/png/webp/gif) et vidéos (mp4/webm/mov)
    • Validation du type MIME et de la taille (ex. <= 50 Mo)
- 🖼️ Miniatures/aperçu automatique + lecteur intégré (image/vidéo)
- 🏷️ Chaque média reçoit un libellé + description optionnelle
- 📚 Les médias capturés/uploadés alimentent une "bibliothèque de médias"
  attachée à la procédure (ProcedureMedia) et sont indexés par id
- 🔗 Référencement dans les étapes : chaque Step peut référencer un ou
  plusieurs médias de la bibliothèque via leur id (step.mediaRefs[])
- ♻️ Réutilisation : un même média peut être affiché/inséré dans plusieurs
  étapes de la séquence (ex. photo de référence d'un composant, vidéo
  de démonstration d'une manipulation) — "utilisé ultérieurement"
- ✏️ Édition/suppression des médias depuis le formulaire, avec mise à jour
  des références dans les étapes
- 💾 Stockage : upload vers un provider (local/azure-blob/s3) + url persistée
  dans ProcedureMedia ; les fichiers binaires ne sont PAS encodés en base64
  dans le JSON de la procédure (on stocke uniquement l'id + url)

B. ProcedureExecutor (components/procedures/execution/ProcedureExecutor.tsx)
---------------------------------------------------------------
Caractéristiques :
- Affichage pas-à-pas des étapes
- Minuteur de progression
- Indicateurs de validation en temps réel
- Dashboard d'alarmes
- Interface de confirmation
- Logs d'exécution
- Mode sombre/clair
- Responsive design

C. ProgressTracker (components/procedures/execution/ProgressTracker.tsx)
---------------------------------------------------------------
Caractéristiques :
- Timeline interactive
- Indicateurs colorés (vert/succès, orange/en cours, rouge/échec)
- Durées par étape
- Points de contrôle
- Zoom sur étape

D. StepGuide (components/procedures/execution/StepGuide.tsx)
---------------------------------------------------------------
Caractéristiques :
- Instructions claires et structurées
- Médias associés
- Boutons d'action contextuels
- Feedback en temps réel
- Aide intégrée
- Mode vocal
```

---

## 🔌 **5. API ROUTES**

```
Implémente les endpoints RESTful suivants :

A. CRUD (app/api/procedures/route.ts)
---------------------------------------------------------------
GET    /api/procedures                  // Liste paginée + filtres
POST   /api/procedures                  // Création
GET    /api/procedures/:id              // Détail
PUT    /api/procedures/:id              // Mise à jour
DELETE /api/procedures/:id              // Suppression

B. Exécution (app/api/procedures/execute/route.ts)
---------------------------------------------------------------
POST   /api/procedures/execute/start    // Démarrer l'exécution
POST   /api/procedures/execute/next     // Étape suivante
POST   /api/procedures/execute/back     // Étape précédente
POST   /api/procedures/execute/pause    // Pause
POST   /api/procedures/execute/resume   // Reprendre
POST   /api/procedures/execute/abort    // Abandonner
GET    /api/procedures/execute/status   // Statut actuel
GET    /api/procedures/execute/progress // Progression

C. Gestion (app/api/procedures/manage/route.ts)
---------------------------------------------------------------
POST   /api/procedures/manage/validate  // Valider une procédure
POST   /api/procedures/manage/publish   // Publier
POST   /api/procedures/manage/archive   // Archiver
POST   /api/procedures/manage/review    // Soumettre pour revue
POST   /api/procedures/manage/approve   // Approuver

D. Templates (app/api/procedures/templates/route.ts)
---------------------------------------------------------------
GET    /api/procedures/templates        // Liste des templates
POST   /api/procedures/templates        // Créer template
GET    /api/procedures/templates/:id    // Détail template

E. 📸 Médias (app/api/procedures/media/route.ts)
---------------------------------------------------------------
POST   /api/procedures/media            // Upload/capture d'un média (image/vidéo)
                                        //   -> crée ProcedureMedia + stocke le fichier
GET    /api/procedures/media?procedureId=// Liste la bibliothèque de médias
DELETE /api/procedures/media/:id        // Supprime un média + ses fichiers
                                        //   + purge les mediaRefs des étapes

E. Analytics (app/api/procedures/analytics/route.ts)
---------------------------------------------------------------
GET    /api/procedures/analytics/stats  // Statistiques générales
GET    /api/procedures/analytics/:id    // Statistiques procédure
```

---

## 🤖 **6. INTÉGRATION RAG**

```
Intègre le RAG pour la recherche et l'enrichissement :

A. ProcedureRAGService (lib/procedures/services/rag.service.ts)
---------------------------------------------------------------
class ProcedureRAGService {
  async indexProcedure(procedure: Procedure): Promise<void>
  async searchProcedures(query: string): Promise<ProcedureSearchResult[]>
  async findSimilarProcedures(procedureId: string): Promise<Procedure[]>
  async enrichProcedure(procedure: Procedure): Promise<EnrichedProcedure>
  
  async generateEmbedding(text: string): Promise<number[]>
  async getSuggestions(context: ProcedureContext): Promise<Suggestion[]>
  async findRelatedDocuments(query: string): Promise<DocumentReference[]>
}

B. Vectorization (lib/procedures/vectorization/embedder.ts)
---------------------------------------------------------------
class ProcedureEmbedder {
  async embedText(text: string): Promise<number[]>
  async embedChunks(chunks: ProcedureChunk[]): Promise<number[][]>
  async batchEmbed(procedures: Procedure[]): Promise<void>
  
  async updateEmbedding(procedureId: string): Promise<void>
  async optimizeEmbedding(): Promise<OptimizationResult>
}
```

---

## 📊 **7. MONITORING ET ANALYTICS**

```
Implémente un système de monitoring complet :

A. ProcedureMonitor (lib/procedures/monitoring/monitor.ts)
---------------------------------------------------------------
class ProcedureMonitor {
  async logEvent(event: ProcedureEvent): Promise<void>
  async getEvents(filters: EventFilters): Promise<Event[]>
  async getMetrics(): Promise<Metrics>
  
  async trackPerformance(executionId: string): Promise<PerformanceData>
  async analyzeFailures(procedureId: string): Promise<FailureAnalysis>
  async generateAlerts(procedureId: string): Promise<Alert[]>
}

B. AnalyticsDashboard (components/procedures/analytics/AnalyticsDashboard.tsx)
---------------------------------------------------------------
Caractéristiques :
- KPIs en temps réel (taux de succès, durée moyenne, etc.)
- Graphiques d'évolution
- Heatmaps des échecs
- Top des procédures les plus utilisées
- Time series des exécutions
- Export des données
```

---

## ✅ **8. TESTS**

```
Crée des tests complets :

A. Unit Tests (__tests__/procedures/)
---------------------------------------------------------------
- procedure-manager.test.ts
- execution-engine.test.ts
- validator.test.ts
- reporting.test.ts
- assistant.test.ts

B. Integration Tests (__tests__/integration/)
---------------------------------------------------------------
- api-procedures.test.ts
- rag-integration.test.ts
- voice-assistant.test.ts
- ui-components.test.ts

C. E2E Tests (__tests__/e2e/)
---------------------------------------------------------------
- create-procedure.test.ts
- execute-procedure.test.ts
- emergency-scenario.test.ts
```

---

## 🎯 **9. CRITÈRES DE SUCCÈS**

```
L'implémentation sera considérée comme réussie si :

1. ✅ Un utilisateur peut créer une procédure complète via l'UI
2. ✅ La procédure est sauvegardée en BDD avec toutes ses métadonnées
3. ✅ L'opérateur peut démarrer la procédure via le chat ou l'UI
4. ✅ L'assistant guide l'opérateur étape par étape
5. ✅ Les alarmes sont détectées et des remèdes sont proposés
6. ✅ L'opérateur peut utiliser la voix pour naviguer
7. ✅ Les médias (images, vidéos) sont intégrés et affichés pour chaque etape affichée de la procedure et peuvent etre editer
7b. ✅ Lors de la configuration, l'utilisateur peut capturer (caméra) ou uploader une image/vidéo, et la réutiliser plus tard dans n'importe quelle étape de la séquence
8. ✅ La progression est visible et suivie
9. ✅ Un rapport d'exécution est généré à la fin
10. ✅ La recherche RAG trouve les procédures pertinentes
11. ✅ Les statistiques d'utilisation sont collectées
12. ✅ L'interface est responsive et accessible
13. ✅ Le système gère les erreurs de manière élégante
14. ✅ Les performances sont optimisées (temps de chargement < 2s)
15. ✅ Le code est propre, documenté et testé
```

---

## 🚀 **10. PHASES DE DÉPLOIEMENT**

```
Phase 1 - Base (Semaine 1) :
- Modèles Prisma et migration
- Services CRUD de base
- API Routes fondamentales
- Types et interfaces

Phase 2 - UI (Semaine 2) :
- Formulaire dynamique
- Liste des procédures
- Éditeur d'étapes
- Visualisation de base

Phase 3 - Exécution (Semaine 3) :
- Moteur d'exécution
- Assistant chat
- Interface d'exécution
- Gestion des alarmes

Phase 4 - Avancé (Semaine 4) :
- Intégration RAG
- Assistant vocal
- Statistiques
- Rapports et export

Phase 5 - Optimisation (Semaine 5) :
- Tests complets
- Optimisation des performances
- Documentation
- Déploiement
```

---

## 💡 **CONSEILS D'IMPLÉMENTATION**

```
1. Utilise les fonctionnalités modernes de Next.js (Server Components, Streaming)
2. Implémente le debouncing et le throttling pour les actions utilisateur
3. Utilise les WebSockets pour les mises à jour en temps réel
4. Implémente un système de cache avec Redis
5. Utilise des workers pour les tâches lourdes (génération PDF, embedding)
6. Implémente des logs structurés pour le debugging
7. Utilise les middlewares Next.js pour l'authentification
8. Implémente des rate limits pour les API
9. Utilises des composants server-side pour le SEO
10. Implémente un système de fallback pour les erreurs critiques
```

---

## 📝 **LIVRABLES ATTENDUS**

```
L'IA doit fournir :

1. ✅ Code complet de tous les fichiers implémentés
2. ✅ Instructions de migration de base de données
3. ✅ Variables d'environnement nécessaires
4. ✅ Documentation d'utilisation
5. ✅ Guide de déploiement
6. ✅ Exemples de procédures préremplies
7. ✅ Scripts de tests
8. ✅ Documentation API (OpenAPI/Swagger)
```

---

## 🔥 **INNOVATIONS ATTENDUES**

```
Pour une implémentation innovante, intégre :

1. 🧠 Apprentissage automatique des séquences d'exécution
2. 🎯 Prédiction des problèmes potentiels avant qu'ils ne surviennent
3. 🤝 Collaboration en temps réel entre plusieurs opérateurs
4. 📱 Application mobile companion avec notifications
5. 🔗 Intégration avec IoT pour des données en temps réel
6. 🧬 Génération automatique de procédures à partir de logs
7. 🎨 Interface adaptative selon le niveau d'expérience
8. 🔐 Blockchain pour l'intégrité des procédures
9. 🗣️ Traduction automatique multi-langues
10. 🤖 Agents autonomes pour des parties de la procédure
```

---

## 🎯 **CONCLUSION**

```
Implémente cette fonctionnalité en suivant cette architecture modulaire,
en assurant une qualité de code exceptionnelle, des performances optimales
et une expérience utilisateur fluide et intuitive.

L'objectif est de créer un système de gestion de procédures industrielles
qui soit à la fois puissant, flexible et facile à utiliser, permettant
aux opérateurs d'être guidés efficacement dans leurs tâches critiques.
```

---

**Ce prompt est prêt à être utilisé avec votre IA de développement pour implémenter la totalité de la fonctionnalité de procédures industrielles interactives !** 🚀