# CLAUDE.md – Plan Prep Coach

## Projektübersicht
**Plan Prep Coach** ist eine Web-App für Trainer, Athleten und Sportwissenschaftler, die den Prozess der Trainingsplanung von Grund auf streamlinet. Die App ersetzt komplexe Excel-Workflows und manuelle Dateneingabe in externe Tools (z.B. Everfit, TrainHeroic) durch einen geführten, intelligenten Wizard.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, shadcn-ui, Supabase

---

## Kernphilosophie
- Trainingsplanung ist eine Kette von abhängigen Entscheidungen – der Wizard führt den Trainer Schritt für Schritt durch diese Kette
- Daten werden **einmal eingegeben** und fließen automatisch durch alle Ebenen durch (kein doppeltes Eintippen)
- Der Trainer soll sich auf **Denken statt Klicken** konzentrieren können
- Jeder Schritt des Wizards hat einen **KI-Chat** zur Diskussion und Beratung

---

## Trainingsplan-Hierarchie
```
Makrozyklus
  └── Mesozyklus(en)
        └── Mikrozyklus(en)  (meist 1 Woche, Dauer konfigurierbar)
              └── Trainingstag(e)
                    └── Session(s) / Einheit(en)
                          └── Sections (Warm-up, Hauptteil, Cooldown)
                                └── Übungen (mit Sets, Reps, Intensität etc.)
```

---

## Datenbanken (vom Coach konfigurierbar)
1. **Athleten-Datenbank** – Profile mit:
   - Demografische Daten (Name, Alter, Geschlecht, etc.)
   - Parameterwerte (z.B. aktuelle 100m-Zeit, Kraftwerte etc.)
   - Zugewiesene Trainingspläne
   - Persönlicher Trainingskalender (nur Sessions & Tagesintensitäten sichtbar)
2. **Parameter-Datenbank** – Ziele (z.B. 100m-Sprintzeit), Sub-Parameter, Abhängigkeiten zwischen Parametern (positiv/negativ), Begründungen + Research-Zitationen
3. **Trainingsmethoden-Datenbank** – Methoden mit Ober-/Unterkategorien, verknüpft mit Parametern
4. **Übungsdatenbank** – Übungen mit Video, Beschreibung, Kategorie (z.B. "Lower Body Resistance Strength"), Parametern

---

## Wizard – Vollständiger Ablauf

### Phase 1: Plan-Setup
**Schritt 1:** Athlet wählen (aus Datenbank) → Werte automatisch geladen
- Planname eingeben
- Zeitraum festlegen (Kalender: Start- & Enddatum)
- Ziel-Parameter wählen (z.B. "100m-Sprintzeit verbessern")

**Schritt 2:** Parameter & Subziele
- Aktuelle Athletenwerte für gewählte Parameter
- Sub-Parameter / Subziele anzeigen (z.B. Kraft, Explosivität, Antritt)
- Abhängigkeiten zwischen Parametern werden in der Parameterdatenbank definiert (nicht hier)

**Schritt 3:** Trainingsmethoden wählen
- Vorgeschlagene Methoden pro Ziel (aus Datenbank verlinkt)
- Methoden abwählen oder manuell ergänzen (landen in Methoden-Datenbank)

---

### Phase 2: Mesozyklus-Planung

**Schritt 1:** Mesozyklen konfigurieren
- Anzahl Mesozyklen + Dauer (z.B. 3 Mesozyklen à 4 Wochen)
- Intensitäten pro Mikrozyklus festlegen:
  `Off → Easy → Moderate → Hard → Extremely Hard`

**Schritt 2:** Mikrozyklus-Intensitäten
- Tagesintensitäten innerhalb jedes Mikrozyklus festlegen (gleiche Skala)

**Schritt 3:** Methoden pro Mesozyklus
- Für jeden Mesozyklus definieren welche Methoden aktiv sind
- Beispiel: Letzter Mesozyklus nur Sprinttraining, kein Krafttraining

**Schritt 4: Periodisierungstabelle** ⭐ (Kernstück)
- Spalten = Mesozyklen mit ihren Mikrozyklen
- Zeilen = Trainingsmethoden (Ober- & Unterkategorien)
- Pro Methode & Mikrozyklus: Frequenz, Sätze, Wiederholungen, Intensität, weitere Parameter
- Diese Werte fließen automatisch durch alle Ebenen durch – bis in den finalen Trainingskalender

**Schritt 5:** Übungsauswahl
- Pro Mesozyklus & Methode: Übungen aus Datenbank wählen
- Übungen haben Videos, Beschreibungen, Kategorien

---

### Phase 3: Mikrozyklus-Planung (Trainingskalender)

**Schritt 1:** Übungen den Tagen zuweisen
- Kalenderansicht mit Intensitäts-Labels (aus Mesozyklus-Planung)
- Labels änderbar (Änderung ist konsistent & rückwirkend)

**Schritt 2:** Session-Architektur aufbauen
- Sections anlegen: Warm-up, Hauptteil, Cooldown
- Kommentare zu Sections und Übungen
- Supersätze erstellen (Übungen verbinden)
- Drag & Drop für Reihenfolge
- Sessions kopieren

**Automatischer Datenfluss:**
- Belastungsparameter aus Periodisierungstabelle erscheinen automatisch bei den Übungen
- Sätze als Zeilen, Parameter als Spalten
- Angezeigte Parameter konfigurierbar (in Parameterdatenbank)

---

### Finaler Output & Planzuweisung
- **Trainingskalender** mit allen Sessions & Parametern vollständig befüllt
- **Zuweisung an Athleten-Profil:**
  - Ein fertiger Trainingsplan kann jedem Athleten zugewiesen werden
  - Die Zuweisung ist **datumsunabhängig** – ein Plan der ursprünglich am 1. Mai erstellt wurde, kann z.B. am 24. April 2027 einem Athleten zugewiesen werden. Das Startdatum wird bei der Zuweisung neu gesetzt, alle Sessions verschieben sich entsprechend
  - Im Athleten-Kalender erscheinen dann nur die relevanten Infos: Sessions & Tagesintensitäten
- **PDF-Export** mit:
  - Vollständigem Trainingsplan
  - Begründungen warum welche Methode gewählt wurde
  - Research-Zitationen aus der Parameterdatenbank
  - KI-unterstützte Formulierung des "Why" – die einzelnen Begründungen aus der Parameterdatenbank werden von der KI zu einem zusammenhängenden, gut lesbaren Text zusammengefügt
  - Für den Athleten verständlich aufbereitet
- Zukünftig: Sessions erscheinen in der Athleten-App (mobil)

---

## Zwei-App-Architektur

### Coach-App (Desktop-first)
- Vollständiger Zugang zum Programming Wizard
- Athleten-Datenbank, Parameter-Datenbank, Methoden-Datenbank, Übungsdatenbank
- Trainingspläne erstellen, verwalten und Athleten zuweisen
- KI-Chat überall verfügbar

### Athleten-App (Mobile-first)
- Schlanke Ansicht – nur das was für den Athleten relevant ist
- Persönlicher Kalender mit zugewiesenen Sessions
- Tagesintensitäten sichtbar
- Sessions öffnen und Details einsehen (Übungen, Sets, Reps, Intensität etc.)
- Kein Zugang zur Planungsebene
- **Jeder Schritt des Wizards** hat einen integrierten KI-Chat
- Der Coach kann jederzeit mit der KI diskutieren: über Parameter, Intensitäten, Methoden, Periodisierung etc.
- KI-Support auch beim PDF-Export für die "Why"-Formulierung
- Generell: KI ist immer verfügbar als Sparringspartner in der gesamten App

---

## Entwicklungsregeln

### Datenfluss (kritisch!)
- Parameter-Werte fließen von oben nach unten durch: Periodisierungstabelle → Übungen → Kalender
- Änderungen an höherer Ebene müssen konsistent nach unten propagieren
- Niemals Daten auf mehreren Ebenen doppelt speichern

### State Management
- Wizard-State muss über alle Schritte erhalten bleiben
- Jeder Schritt baut auf dem vorherigen auf
- Beim Zurückgehen dürfen keine Daten verloren gehen
- **Bidirektionale Synchronisation:** Änderungen in einem späteren Schritt müssen sich automatisch in allen vorherigen und nachfolgenden Schritten widerspiegeln – der gesamte Wizard-State ist immer konsistent
- Keine isolierten lokalen States pro Schritt – immer einen zentralen, geteilten State verwenden

### UI/UX Prinzipien
- Jeder Wizard-Schritt hat einen KI-Chat zur Beratung
- Drag & Drop wo möglich (Session-Aufbau)
- Intensitäts-Labels konsistent durch die gesamte App
- Mobile-first für Athleten-Ansicht, Desktop-first für Coach-Ansicht

### Code-Qualität
- TypeScript strict mode – keine `any` Types
- Komponenten klein und wiederverwendbar halten
- Komplexe Logik in eigene Hooks auslagern
- Vor größeren Änderungen immer den bestehenden Code analysieren

---

## Bekannte Komplexitäten
- Periodisierungstabelle ist die komplexeste Komponente (viele verschachtelte Daten)
- Abhängigkeiten zwischen Parametern müssen korrekt dargestellt werden
- Automatischer Datenfluss von Meso → Mikro → Session ist kritisch
- PDF-Export muss strukturiert und athletengerecht sein

---

## Wichtige Hinweise für Claude Code
- Immer erst den bestehenden Code verstehen bevor Änderungen gemacht werden
- Bei komplexen Features: erst planen, dann implementieren
- Den Datenfluss durch alle Ebenen im Blick behalten
- Keine Breaking Changes an der Datenbankstruktur ohne explizite Bestätigung
