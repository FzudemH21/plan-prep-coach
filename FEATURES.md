# Feature-Liste Plan Prep Coach

## Kontext
Ich bin Athletin, Trainerin und Sportwissenschaftlerin.
Ich entwickle Plan Prep Coach - eine Web-App die den Trainingplanungsprozess streamlinet.
**Tech Stack:** React, TypeScript, Vite, Tailwind, shadcn-ui, Supabase
**GitHub:** https://github.com/FzudemH21/plan-prep-coach
Ich arbeite mit Claude Code im Terminal für Code-Änderungen.
Du bist mein Sparringspartner für Planung, Diskussion und Prompts für Claude Code.

---

## Feature-Liste

| Priorität | Feature | Status |
|---|---|---|
| 🔴 Jetzt | Code Audit Sofort-Punkte (1-4) | ✅ Erledigt |
| 🔴 Jetzt | Athleticism DB v1 entfernen | ✅ Erledigt |
| 🔴 Jetzt | Session-Card: Übungsanzahl entfernen | ✅ Erledigt |
| 🔴 Jetzt | Notizfeld Wizard + Sync | ✅ Erledigt |
| 🔴 Jetzt | Session-Card Overflow fixen | ✅ Erledigt |
| 🔴 Jetzt | Notizfeld Athletenprofil | ✅ Erledigt |
| 🔴 Jetzt | Bulk Import Übungen (CSV/Excel) | ✅ Erledigt |
| 🔴 Jetzt | Bulk Import Fixes (3-Schritt-Flow, Description optional, konsistente Speicherung) | ✅ Erledigt |
| 🔴 Jetzt | Dynamisches Übungsdetail-Modal (Spalten aus Datenbank, keine hardcodierten Felder, direkt editierbar) | ✅ Erledigt |
| 🟡 Bald | Coach-Profil & Onboarding (KI-Gespräch zum Kennenlernen der Coaching-Philosophie, KI stellt Folgefragen, Ergebnis wird als Coach-Profil gespeichert und reviewbar) | ⬜ Offen |
| 🟡 Bald | Plan-Uploads für Coach-Profil (Excel, PDF, Word und andere Dateien hochladbar, Coach gibt Kontext dazu, KI extrahiert Muster und reichert Coach-Profil an) | ⬜ Offen |
| 🟡 Bald | KI-Autopilot im Wizard (Vorschläge & Vorausfüllen von Intensitäten, Methoden, Übungen basierend auf Coach-Profil) | ⬜ Offen |
| 🟡 Bald | Accumulated Context (automatischer Abgleich KI-Vorschlag vs. finaler Plan, KI fragt dosiert nach bei signifikanten Abweichungen – max. 1-2 pro Plan, skipbar, Antworten fließen als Begründungen in Kontext ein) | ⬜ Offen |
| 🟡 Bald | Spracheingabe für Coach (Athletenbeschreibung per Sprache im Athletenprofil und Wizard-Start, Web Speech API + Anthropic API) | ⬜ Offen |
| 🟡 Bald | Masterplaner-Ansicht Athletenkalender (Tag 1, Tag 2... pro Wochentag) | ✅ Erledigt |
| 🟡 Bald | Tests & Events im Athletenkalender + Sync mit Wizard | ⬜ Offen |
| 🟡 Bald | Dokumente hochladen + Freigabe für Athleten | ⬜ Offen |
| 🟡 Bald | Programming-Templates für Trainingsmethoden | ⬜ Offen |
| 🟡 Bald | Spalten verschieben in Datenbanken (Drag & Drop) | ✅ Erledigt |
| 🟠 Später | Goal Management + Testbenachrichtigungen | ⬜ Offen |
| 🟠 Später | Datumsunabhängiger Plan (Template-Modus) | ⬜ Offen |
| 🔵 Zukunft | Athleten-App (mobil, separat) | ⬜ Offen |
| 🔵 Zukunft | Wearable & App Integrationen (Oura, Whoop, Apple Fitness, VBT) | ⬜ Offen |
| 🔵 Zukunft | SaaS & Monetarisierung (Login, Pakete, Stripe) | ⬜ Offen |
| 🔵 Zukunft | Buchungssystem (Athleten buchen beim Coach) + Coach-Kalender | ⬜ Offen |
| 🔵 Zukunft | Zahlungssystem Coach↔Athlet (Marketplace-Modell) | ⬜ Offen |

---

## Workflow
- Claude Code im Terminal für alle Code-Änderungen
- Dieser Chat als Sparringspartner für Planung & Prompts
- Nach jedem Milestone: `git add . && git commit -m "..."` 
- Kontext bei 70%+ → `/clear` in Claude Code
- Neue Chat-Session → CLAUDE.md + FEATURES.md sind im Projekt hinterlegt
