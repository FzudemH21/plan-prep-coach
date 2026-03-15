# Technology Stack

**Analysis Date:** 2026-03-15

## Languages

**Primary:**
- TypeScript 5.8.3 - All source code and configuration
- TSX - React component files with TypeScript

**Secondary:**
- JavaScript - ESLint configuration files
- CSS - Base styling definitions via Tailwind

## Runtime

**Environment:**
- Node.js (version not explicitly specified in lockfile, typical for modern React/Vite projects)

**Package Manager:**
- npm - lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React 18.3.1 - UI rendering and component architecture
- React Router v6.30.1 - Client-side routing for multi-page navigation
- React DOM 18.3.1 - DOM rendering

**UI Component Library:**
- shadcn/ui - Component library built on Radix UI primitives (extensive Radix UI components)
  - @radix-ui/* 1.1-1.2 versions - Unstyled, accessible primitives
  - Includes: accordion, alert-dialog, checkbox, dialog, dropdown-menu, popover, select, tabs, tooltip, scroll-area, and more

**Styling:**
- Tailwind CSS 3.4.17 - Utility-first CSS framework
- PostCSS 8.5.6 - CSS transformation
- Autoprefixer 10.4.21 - Vendor prefixing
- tailwind-merge 2.6.0 - Merge Tailwind class lists
- tailwindcss-animate 1.0.7 - Animation utilities

**Forms & Validation:**
- React Hook Form 7.61.1 - Form state management
- @hookform/resolvers 3.10.0 - Schema validation integration
- Zod 3.25.76 - TypeScript-first schema validation

**Data & State Management:**
- @tanstack/react-query 5.83.0 - Server state management, caching, and synchronization

**UI Components & Utilities:**
- Lucide React 0.462.0 - Icon library
- Sonner 1.7.4 - Toast notification system
- Recharts 2.15.4 - Chart library for data visualization
- date-fns 3.6.0 - Date utility library
- react-day-picker 8.10.1 - Calendar picker component
- embla-carousel-react 8.6.0 - Carousel/carousel component
- react-resizable-panels 2.1.9 - Resizable panel layouts
- cmdk 1.1.1 - Command palette/menu component
- input-otp 1.4.2 - OTP input component
- class-variance-authority 0.7.1 - CSS class composition utility
- clsx 2.1.1 - Conditional class joining
- vaul 0.9.9 - Drawer component
- @hello-pangea/dnd 18.0.1 - Drag and drop functionality (fork of react-beautiful-dnd)
- next-themes 0.3.0 - Theme management (dark/light mode)

**Build & Development:**
- Vite 5.4.19 - Build tool and dev server
- @vitejs/plugin-react-swc 3.11.0 - React plugin using SWC for faster builds
- lovable-tagger 1.1.9 - Development helper for component tagging

**Linting & Type Checking:**
- ESLint 9.32.0 - Code linting
- typescript-eslint 8.38.0 - TypeScript support for ESLint
- eslint-plugin-react-hooks 5.2.0 - React hooks linting
- eslint-plugin-react-refresh 0.4.20 - React refresh linting
- globals 15.15.0 - Global variable definitions

**TypeScript Utilities:**
- @types/react 18.3.23 - React type definitions
- @types/react-dom 18.3.7 - React DOM type definitions
- @types/node 22.16.5 - Node.js type definitions

## Configuration

**Environment:**
- TypeScript strict mode is disabled:
  - `noImplicitAny: false` - Allow implicit any types
  - `strictNullChecks: false` - Null/undefined are assignable to any type
  - `noUnusedLocals: false` - Allow unused local variables
  - `noUnusedParameters: false` - Allow unused parameters
  - `skipLibCheck: true` - Skip type checking of declaration files
  - `allowJs: true` - Allow JavaScript alongside TypeScript
- Path aliases configured: `@/*` maps to `./src/*` in both Vite and TypeScript
- Tailwind CSS includes custom design tokens (intensity levels, mesocycle colors)
- Dark mode supported via class-based strategy

**Build:**
- Vite config: `vite.config.ts`
- TypeScript app config: `tsconfig.app.json`
- TypeScript node config: `tsconfig.node.json`
- ESLint config: `eslint.config.js`
- PostCSS config: `postcss.config.js`
- Tailwind config: `tailwind.config.ts`

## Platform Requirements

**Development:**
- Node.js and npm (version not restricted in package.json)
- Modern browser with ES2020+ support
- Port 8080 (Vite dev server default)

**Production:**
- Static site hosting (Vite builds to static HTML/JS/CSS)
- No backend API server required (data stored in browser localStorage)
- Modern browser with JavaScript enabled

---

*Stack analysis: 2026-03-15*
