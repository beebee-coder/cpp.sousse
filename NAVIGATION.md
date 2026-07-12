# 🗺️ Mode System - Navigation Guide

## Quick Links to Demo Pages

### Home Demos
- **Dashboard**: `/demo` - Main hub with quick start
- **Mode Showcase**: `/demo/modes` - See all 3 modes in detail
- **Integration Examples**: `/demo/examples` - 9 copy-paste examples

## 📚 Documentation Files

### Main Docs
- **MODE_SYSTEM.md** - Complete system documentation
- **INTEGRATION_CHECKLIST.md** - Step-by-step integration guide
- **ARCHITECTURE.js** - Visual architecture overview

### In This File
- This file (navigation guide)

## 🎨 Component Quick Reference

### Display Mode Badge
```tsx
// File: src/components/ModeIndicator.tsx
import { ModeBadge } from '@/components/ModeIndicator';

<ModeBadge />  // Shows current mode with icon
```

### Get Mode Information
```tsx
// File: src/hooks/use-app-mode.ts
import { useAppMode } from '@/hooks/use-app-mode';

const { mode, isOnline, isDesktop, localOnly, setLocalOnly } = useAppMode();
```

### Live Indicator for Headers
```tsx
// File: src/components/ModeLiveIndicator.tsx
import { ModeLiveIndicator } from '@/components/ModeLiveIndicator';

<ModeLiveIndicator variant="full" />   // Full badge
<ModeLiveIndicator variant="minimal" /> // Just icon
```

### Sidebar Widget
```tsx
// File: src/components/ModeStatusWidget.tsx
import { ModeStatusWidget } from '@/components/ModeStatusWidget';

<ModeStatusWidget />  // Dropdown with status
```

### Show Notifications
```tsx
// File: src/components/ModeLiveIndicator.tsx
import { ModeNotification } from '@/components/ModeLiveIndicator';

<ModeNotification />  // Toast for offline/hybrid
```

## 🎭 Mode Details

### Web Mode ☁️
- **When**: User on Vercel URL, no desktop app
- **Theme**: Blue/Cyan gradient
- **Badge Icon**: ☁️
- **Features**: Cloud sync, full AI, collaborative

### Hybrid Mode 🔗
- **When**: Desktop app installed + online
- **Theme**: Purple/Pink gradient
- **Badge Icon**: 🔗
- **Features**: Local + cloud, smart cache, toggle offline

### Offline Mode ⚡
- **When**: Desktop app + offline OR user forces local
- **Theme**: Amber/Orange gradient
- **Badge Icon**: ⚡
- **Features**: Autonomous, fast, private, 100% local

## 🧪 Testing Guide

### Test Web Mode
1. Visit `http://localhost:3000/demo/modes`
2. Should show: **☁️ Web Mode** badge
3. Desktop: False, Online: True

### Test Hybrid Mode
1. Simulate desktop: DevTools > Customize and control DevTools > More tools > Network conditions > Offline (disable, then re-enable)
2. Or: Use the toggle in the mode detail card
3. Should show: **🔗 Mode Hybride** badge

### Test Offline Mode
1. Open DevTools > Network tab
2. Check "Offline" checkbox
3. Refresh page or toggle in detail card
4. Should show: **⚡ Mode Offline** badge
5. See amber/orange theme applied

## 📁 File Location Reference

```
F:\cpp.sousse-initiale1\cpp.sousse-main\

┌─ src/
│  ├─ components/
│  │  ├─ ModeIndicator.tsx ................. Badge + Card
│  │  ├─ ModeLayout.tsx ................... 3 layouts
│  │  ├─ ModeAwareLayout.tsx .............. Wrapper
│  │  ├─ ModeLiveIndicator.tsx ............ Header indicator
│  │  ├─ ModeStatusWidget.tsx ............. Sidebar widget
│  │  └─ ModeExamples.tsx ................. 9 examples
│  │
│  ├─ hooks/
│  │  └─ use-app-mode.ts .................. Mode hook
│  │
│  └─ app/
│     ├─ demo/
│     │  ├─ page.tsx ...................... Index
│     │  ├─ modes/page.tsx ................ Showcase
│     │  └─ examples/page.tsx ............. Examples
│     ├─ layout.tsx (modified)
│     └─ globals.css (modified)
│
├─ MODE_SYSTEM.md ........................ Full docs
├─ INTEGRATION_CHECKLIST.md .............. Step-by-step
├─ ARCHITECTURE.js ....................... Visual architecture
└─ NAVIGATION.md ......................... This file
```

## 🔧 Integration Paths

### Path 1: Quick Display
→ Just show the badge
→ File: `ModeIndicator.tsx`
→ Export: `ModeBadge`

### Path 2: Feature Toggle
→ Use hook to enable/disable features
→ File: `use-app-mode.ts`
→ Export: `useAppMode`

### Path 3: Header Integration
→ Add to navbar/header
→ File: `ModeLiveIndicator.tsx`
→ Export: `ModeLiveIndicator`

### Path 4: Sidebar Integration
→ Add to sidebar footer
→ File: `ModeStatusWidget.tsx`
→ Export: `ModeStatusWidget`

### Path 5: Full Page Theme
→ Wrap entire layout
→ File: `ModeLayout.tsx`
→ Export: `ModeLayout`

## 🎯 Most Common Use Cases

### "Show mode badge in header"
```
→ Use: ModeLiveIndicator from ModeLiveIndicator.tsx
→ Variant: "full"
```

### "Show offline notification"
```
→ Use: ModeNotification from ModeLiveIndicator.tsx
→ Auto-shows when offline
```

### "Disable feature if offline"
```
→ Use: useAppMode hook
→ Check: mode === 'locale' || (mode === 'hybride' && !isOnline)
```

### "Show detailed mode info in settings"
```
→ Use: ModeDetailCard from ModeIndicator.tsx
→ Shows all details + local-only toggle
```

## 🚀 Getting Started (5 Minutes)

1. **Visit demo** → `http://localhost:3000/demo`
2. **Browse showcase** → Click "🎭 Mode System"
3. **See examples** → Click "📚 Integration Examples"
4. **Test offline** → DevTools Network → Offline checkbox
5. **Integrate** → Copy from ModeExamples.tsx

## 📞 Troubleshooting

### Badge not showing?
- Check: ModeAwareLayout in layout.tsx ✓
- Check: PlatformProvider wrapper ✓
- Try: Hard refresh (Ctrl+Shift+R)

### Mode not changing?
- Check: Browser DevTools Network (Offline)
- Or: Use ModeDetailCard toggle for testing
- Check: useAppMode returns correct mode

### Styles look wrong?
- Check: Tailwind CSS configured ✓
- Try: npm run dev restart
- Check: globals.css animations loaded

### Where's the source?
- Hook logic: `src/hooks/use-app-mode.ts`
- Components: `src/components/Mode*.tsx`
- Styles: `src/app/globals.css`
- Pages: `src/app/demo/**`

## 📊 Status

✅ All components created
✅ All animations added
✅ All docs written
✅ Demo pages ready
✅ Examples provided
✅ Ready for production

---

**Version**: 1.0  
**Created**: 2026-07-12  
**Status**: Production Ready
