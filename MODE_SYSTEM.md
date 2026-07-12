# 🎭 Système de Modes VisioNode

Implémentation complète d'un système de détection et d'affichage de trois modes d'opération distincts pour VisioNode avec UI Tailwind CSS unique et badges innovants.

## 📋 Modes Disponibles

### 1️⃣ **Mode Web** ☁️
- **Plateforme**: Vercel Cloud
- **Détection**: Utilisateur accède via URL Vercel (pas de Tauri)
- **Connexion**: Toujours en ligne
- **Thème**: Bleu/Cyan - sentiment cloud, moderne, connecté
- **Caractéristiques**:
  - ✅ Pipeline IA complet
  - ✅ Traitement Cloud haute performance
  - ✅ Synchronisation multi-appareils
  - ✅ Support collaboratif

### 2️⃣ **Mode Hybride** 🔗
- **Plateforme**: Application Tauri + Cloud Bridge
- **Détection**: Application installée (Tauri) + Connexion Internet
- **Thème**: Pourpre/Rose - sentiment de fusion, innovation, bridge
- **Caractéristiques**:
  - ⚡ Traitement local rapide
  - 🔄 Synchronisation automatique
  - 📦 Cache intelligent
  - 🔋 Prêt pour mode offline
  - Permet forçage du mode local si souhaité

### 3️⃣ **Mode Offline** ⚡
- **Plateforme**: Application Tauri Native
- **Détection**: Application installée + PAS de connexion Internet (ou forcé par l'utilisateur)
- **Thème**: Ambre/Orange - sentiment d'autonomie, batterie, offline
- **Caractéristiques**:
  - 🔒 Entièrement privé
  - ⚡ Ultra rapide
  - 🔋 Aucune batterie requise
  - 🛡️ Sécurisé localement
  - Travail 100% autonome

## 🏗️ Architecture

### Fichiers Créés / Modifiés

```
src/
├── hooks/
│   └── use-app-mode.ts                    # Hook existant amélioré
├── components/
│   ├── ModeIndicator.tsx                  # ✨ Badge innovant + card détails
│   ├── ModeLayout.tsx                     # 🎨 3 layouts uniques par mode
│   ├── ModeAwareLayout.tsx                # 🧬 Wrapper smart
│   ├── ModeLiveIndicator.tsx              # 📊 Indicateurs live pour headers
│   └── dashboard/
│       └── AppChrome.tsx                  # [Modifié] Intégration
├── app/
│   ├── layout.tsx                         # [Modifié] Intégration ModeAwareLayout
│   ├── globals.css                        # [Modifié] + Animations
│   └── demo/
│       └── modes/
│           └── page.tsx                   # 📚 Page de démo
```

### Composants Principaux

#### 1. **ModeIndicator.tsx**
```tsx
// Badge avec animations
<ModeBadge />  // Affiche le mode avec icon, gradient, glow

// Card détaillée
<ModeDetailCard />  // Infos détaillées du mode actuel
```

#### 2. **ModeLayout.tsx**
```tsx
// Wrapper smart qui applique le thème
<ModeLayout showModeIndicator={true}>
  {children}
</ModeLayout>
```

Chaque mode a son propre layout:
- **WebLayout**: Gradients bleu/cyan, orbs flottants
- **HybridLayout**: Gradients pourpre/rose, grille animée
- **LocalLayout**: Gradients ambre/orange, pulses chauds

#### 3. **ModeLiveIndicator.tsx**
```tsx
// Minimal: juste l'icon
<ModeLiveIndicator variant="minimal" />  // ☁️ ou 🔗 ou ⚡

// Full: badge complet
<ModeLiveIndicator variant="full" />     // Badge + status

// Menu contextuel
<ModeContextMenu />

// Notifications
<ModeNotification />  // Toast pour offline/hybride
```

## 🎨 Design Tokens

### Web Mode (☁️)
```
Gradient: from-blue-500 to-cyan-400
Icon: ☁️
Glow: shadow-blue-500/50
Background: Bleu vers cyan avec orbs
```

### Hybrid Mode (🔗)
```
Gradient: from-purple-500 to-pink-400
Icon: 🔗
Glow: shadow-purple-500/50
Background: Pourpre/rose avec grille animée
```

### Local Mode (⚡)
```
Gradient: from-amber-500 to-orange-400
Icon: ⚡
Glow: shadow-amber-500/50
Background: Ambre/orange avec pulses
```

## 🚀 Utilisation

### Dans le Layout Principal
```tsx
import { ModeAwareLayout } from '@/components/ModeAwareLayout';

export default function RootLayout({ children }) {
  return (
    <ModeAwareLayout>
      {children}
    </ModeAwareLayout>
  );
}
```

### Badge dans Header/Navbar
```tsx
import { ModeLiveIndicator } from '@/components/ModeLiveIndicator';

export function Navbar() {
  return (
    <nav>
      <ModeLiveIndicator variant="full" />
    </nav>
  );
}
```

### Affichage des Infos Détaillées
```tsx
import { ModeBadge, ModeDetailCard } from '@/components/ModeIndicator';

export function Dashboard() {
  return (
    <div>
      <ModeBadge />
      <ModeDetailCard />
    </div>
  );
}
```

### Hook pour Logique Conditionnelle
```tsx
import { useAppMode } from '@/hooks/use-app-mode';

export function MyComponent() {
  const { mode, isOnline, isDesktop, localOnly, setLocalOnly } = useAppMode();

  if (mode === 'locale') {
    // Logique offline
  }

  if (mode === 'hybride' && !isOnline) {
    // Utiliser le cache local
  }

  return (
    <div>
      Mode actuel: {mode}
      Online: {isOnline ? '🟢' : '🔴'}
    </div>
  );
}
```

## 🎯 Fonctionnalités Clés

### ✨ Animations
- `animate-float` / `animate-float-slow`: Orbs flottants
- `animate-grid-pan`: Grille animée
- `animate-pulse`: Pulses chauds
- `animate-pulse-ring`: Pulsations en anneau

### 🎭 Thèmes Visuels
Chaque mode a sa propre atmosphère:
- **Web**: Moderne, cloud, connecté → Blue theme
- **Hybride**: Innovation, fusion, bridge → Purple theme  
- **Locale**: Autonome, offline, batterie → Amber theme

### 🔄 Détection Automatique
Le hook `useAppMode()` détecte automatiquement:
1. Si c'est une app Tauri (isDesktop)
2. La connexion Internet (online)
3. Le forçage du mode local (localStorage)
4. Change automatiquement lors de perte/regain connexion

### 📱 Responsive
- Tous les composants sont responsive
- Badges s'adaptent à l'écran
- Layouts fluides et accessibles

## 📊 Page de Démo

Accédez à `/demo/modes` pour voir :
- Statut du mode actuel
- Tous les détails (desktop, online, localOnly)
- 3 cards showcase (Web, Hybride, Offline)
- Mode detail card interactive

```
http://localhost:3000/demo/modes
```

## 🔧 Configuration

### Changer le mode de test
```tsx
const { localOnly, setLocalOnly } = useAppMode();

// Forcer le mode local
setLocalOnly(true);

// Revenir au mode normal
setLocalOnly(false);
```

### Désactiver le badge
```tsx
<ModeAwareLayout showBadge={false}>
  {children}
</ModeAwareLayout>
```

## 🎓 Intégration Existante

Le système utilise la structure existante:
- ✅ Hook `useAppMode` déjà présent et fonctionnel
- ✅ `PlatformProvider` pour Tauri detection
- ✅ Système `api-hybrid.ts` pour fallback offline
- ✅ Tailwind CSS déjà configuré
- ✅ Layout principals avec SessionProvider

## 🚨 Notes Importantes

1. **ModeLayout doit wrapper le contenu entier** pour que les backgrounds/thèmes s'appliquent
2. **ModeBadge est déjà inclus dans ModeLayout**, pas besoin de le dupliquer
3. **ModeLiveIndicator** est pour les headers/navbars (plus compact)
4. **Animations respectent prefers-reduced-motion** pour accessibilité
5. **Tous les composants sont 'use client'** (client-side)

## 🎨 Customisation

### Changer les couleurs
Modifiez dans `ModeIndicator.tsx` et `ModeLayout.tsx`:
```tsx
const badgeConfig = {
  web: {
    gradient: 'from-YOUR-COLOR to-YOUR-COLOR',
    // ...
  },
};
```

### Ajouter des animations
Ajoutez dans `globals.css`:
```css
@keyframes my-animation {
  0% { /* ... */ }
  100% { /* ... */ }
}

.animate-my-animation {
  animation: my-animation 2s infinite;
}
```

## 📞 Support

Pour toute question ou modification:
- Vérifiez que `useAppMode()` retourne les valeurs attendues
- Assurez-vous que `PlatformProvider` wrap l'app
- Vérifiez les breakpoints Tailwind si responsive issues
- Testez offline dans DevTools (Network tab)

---

**Système créé avec ❤️ pour VisioNode | Mode Detection System v1.0**
