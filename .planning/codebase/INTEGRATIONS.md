# External Integrations

**Analysis Date:** 2026-03-15

## APIs & External Services

**YouTube:**
- Service: Video hosting and embedding
  - Client: Embedded via `<iframe>` with YouTube embed URLs
  - Usage: Exercise video playback
  - Implementation: `src/components/shared/ExerciseDetailDialog.tsx`
  - Pattern: Converts YouTube video IDs to embed URLs (`https://www.youtube.com/embed/{videoId}`)
  - Thumbnail generation: `https://img.youtube.com/vi/{videoId}/mqdefault.jpg`

**No Backend API Integration:**
- Current state: Application is fully client-side
- No HTTP calls to external APIs
- No authentication provider integration

## Data Storage

**Storage Model:**
- Primary: Browser localStorage only
- No database backend currently

**Data Persistence:**
- localStorage key: `custom_libraries` - Custom exercise libraries
- localStorage key: `trainingPrograms` - Training program plans and wizard state
- localStorage key: `athleteDatabase` - Athlete profiles, groups, biometrics, performance parameters
- Cross-tab synchronization: Custom sync events (`useLocalStorage:sync`) for multi-instance coordination
- Multi-instance coordination: Custom storage event handling to prevent data loss when multiple components access same key

**localStorage Structure:**
- `CustomLibraryData` - Extensible libraries with custom columns (`src/contexts/CustomLibrariesContext.tsx`)
- `TrainingProgramsData` - Full wizard state and program definitions (`src/hooks/useTrainingPrograms.ts`)
- `AthleteDatabase` - Athlete groups, athletes, biometric definitions, biometric values, performance parameters, calendar assignments (`src/hooks/useAthletes.ts`)

**File Storage:**
- Local filesystem references only
- Video URLs stored as links (YouTube or relative URLs)
- No file upload capability currently

**Caching:**
- React Query (@tanstack/react-query) configured but not actively used for API calls (application is client-only)
- localStorage serves as primary cache layer

## Authentication & Identity

**Auth Provider:**
- Custom - Not integrated
- State: No authentication system currently implemented
- CLAUDE.md indicates future integration of Supabase, but not yet in place

## Monitoring & Observability

**Error Tracking:**
- Console logging for errors
- Toast notifications for user-facing errors (`src/hooks/use-toast.ts`)
- No external error tracking service

**Logs:**
- Browser console via `console.error()` and `console.log()`
- No centralized logging

## CI/CD & Deployment

**Hosting:**
- Static hosting platform required (any provider supporting SPA serving)
- No backend server required

**CI Pipeline:**
- Not detected
- Vite build output: static files only

**Build Process:**
- `npm run build` → Vite production build
- `npm run build:dev` → Development mode build
- `npm run dev` → Development server with HMR
- `npm run lint` → ESLint analysis
- Output directory: `dist/` (default Vite output)

## Environment Configuration

**No environment variables required:**
- Application operates without external service credentials
- All configuration is static in source code
- No `.env` files needed for functionality

**Secrets location:**
- Not applicable - No external services with credentials

**Future Integration Points (from CLAUDE.md):**
- Supabase for backend database
- Supabase authentication
- External integrations with Everfit or TrainHeroic (mentioned as future replacement)

## Webhooks & Callbacks

**Incoming:**
- None currently

**Outgoing:**
- None currently

## Data Flow (Current Architecture)

**Client-Side Only:**
```
UI Components → React Context/Hooks → localStorage
    ↓                                       ↓
React Query (configured but unused) ← Custom sync events
```

**Storage Pattern:**
- `useLocalStorage` hook provides React state synchronized with localStorage
- Writes are compared before persisting (avoid unnecessary writes)
- Custom sync event dispatched on write to notify other instances
- Both native `storage` events (cross-tab) and custom events (same-tab) handled

**Application Architecture:**
- All data transformations happen in client-side hooks and contexts
- No API calls or external service communication
- Wizard state persisted across sessions in localStorage
- Multiple training programs, athlete profiles, and libraries coexist in parallel

---

*Integration audit: 2026-03-15*
