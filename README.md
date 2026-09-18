# Verifizierter Anonymchat – Prototyp (Phase 1)

Zufalls-Textchat, bei dem sich alle Teilnehmenden einmal ausweisen müssen.
Gegenüber anderen bleibt man anonym – gegenüber dem System nicht. Genau
deshalb wirkt eine Sperre dauerhaft und nicht nur bis zum nächsten Konto.

**Dieser Prototyp ist vollständig simuliert.** Es gibt kein Backend, keine
echte Ausweisprüfung und keine anderen Menschen. Der Zweck ist, Flow und UX
testbar zu machen.

## Setup

Voraussetzung: Node 20 oder neuer (entwickelt mit Node 22).

```bash
npm install
npm run dev           # Entwicklungsserver auf http://localhost:5173
npm run build         # Typprüfung + Produktionsbuild nach dist/
npm run build:static  # Build für statische Auslieferung (Hash-Routing,
                      # relative Pfade – für Hosting ohne Server-Rewrites)
npm run preview       # Build lokal ausliefern
npm run test          # Vitest (Wortfilter, Storage, mockApi)
npm run lint          # oxlint
```

Die App läuft vollständig offline: Schriften sind als npm-Pakete lokal
gebündelt, es gibt keine CDN-Einbindung, keine Remote-Bilder und zur
Laufzeit keinen einzigen Netzwerk-Aufruf.

## Funktionsumfang

| Bereich | Enthalten |
| --- | --- |
| Onboarding | Startseite mit Konzept, simulierte Verifizierung in drei Schritten (Dokument, Lebendprüfung, Abgleich), Status in `localStorage` |
| Profil | Zufälliges Pseudonym („Blauer Falke 4417"), Sprache, Altersgruppe, bis zu fünf Interessen – nur fürs Matching |
| Matching | Optionaler Filter, Warteschlange mit Suchlauf, Treffer nach 1–3 s, Fall „niemand passendes erreichbar" |
| Chat | Textchat mit Tippindikator, Skript-Antworten, „Nächster Chat", „Chat beenden", „Melden" |
| Moderation | Lokaler Wortfilter (markiert, blockiert nicht), Warnung vor dem Senden bei schweren Treffern, Melde-Dialog mit fünf Gründen und Freitext, Moderationsansicht unter `/admin` |
| Selbstschutz | Verhaltenskodex einmalig vor dem ersten Chat, „Nicht mehr verbinden" blockiert ein Konto nur für einen selbst (ohne Meldung), Übersicht und Aufhebung im Profil |

Zwei Arten von Ausschluss, bewusst getrennt:

- **Sperre durch die Moderation** – Folge einer Meldung, gilt systemweit und
  ist im Prototyp unter `/admin` sichtbar.
- **Eigene Blockierung** – betrifft nur das eigene Matching, die Moderation
  erfährt nichts davon. Wer meldet, blockiert automatisch mit.

Der Chatverlauf lebt ausschliesslich im Arbeitsspeicher und wird beim Beenden
verworfen. Nur wenn gemeldet wird, wandern die letzten acht Nachrichten als
Auszug in die Meldung – im Dialog offen ausgewiesen.

### Die Datei beim Upload

Das gewählte Dokument wird **nicht gelesen, nicht gespeichert und nicht
gesendet**. Die App zeigt nur den Dateinamen an; der Inhalt wird nie
angefasst (siehe `submitDocument()` in `src/services/mockApi.ts`).

## Architektur

```
src/
  routes/       Landing · Verify · Profile · Chat · Admin · NotFound
  components/   AppShell, Lobby, Queue, ChatRoom, MessageList, Composer,
                ReportDialog, CodexDialog, Dialog, VerifiedBadge,
                ThemeToggle, ui
  services/     mockApi.ts   ← einzige "Backend"-Grenze
                *.test.ts    Vitest-Tests für Filter, Storage und mockApi
                storage.ts   defensive localStorage-Hülle (try/catch)
                types.ts · wordFilter.ts · pseudonym.ts · partnerScript.ts
  store/        useSession · useChat · useModeration · useTheme (Zustand)
  styles/       index.css – Tailwind v4 und alle Farbtokens
```

**Regel:** Komponenten sprechen nie direkt mit `localStorage` und enthalten
keine Mock-Logik. Sie rufen Stores auf, Stores rufen `mockApi` auf. Alle
Funktionen in `mockApi.ts` sind `Promise`-basiert, haben künstliche Latenz
und akzeptieren dort, wo gewartet wird, ein `AbortSignal`. Für Phase 2 wird
diese eine Datei gegen einen HTTP-/WebSocket-Client getauscht; Typen,
Stores und UI bleiben unverändert.

Persistiert werden unter dem Präfix `vac.v1.` nur: Identität und
Verifizierungsstatus, Meldungen, Sperrliste, eigene Blockierungen,
Kodex-Bestätigung, Themenwahl. Jeder Zugriff ist
gekapselt – bei blockiertem oder leerem Storage startet die App normal und
weist im Kopfbereich darauf hin.

## Design

Leitgedanke: Vertrauen und Ruhe statt Dating-App. Die Referenz ist ein
sauber gesetztes Dokument, nicht eine verspielte Oberfläche – die
Verifizierung erscheint als nüchternes Siegel, sichtbar, aber nicht
beworben.

- **Farben** (Light/Dark als Tokens in `src/styles/index.css`): kühles
  Papier `#EDF0EE`, Fläche `#FFFFFF`, Tiefgrün-Schwarz `#141F1C`, gedeckter
  Petrol-Akzent `#1F6F63`, Grau mit Grünstich `#5D6B67`, gedämpfter Ziegel
  `#9E4130` für Meldungen und Warnungen. Ein Akzent, ein Signalton – mehr
  nicht. Alle Text-Hintergrund-Paare erreichen mindestens 4.5:1.
- **Typografie**: Source Serif 4 für Überschriften (dokumenthaft, seriös),
  IBM Plex Sans für Fliesstext, IBM Plex Mono für Pseudonyme, Kennungen,
  Zeitstempel und Statuslabels. Das ist die inhaltliche Pointe: Was das
  System über eine Person weiss, ist typografisch als Systemwert markiert.
- **Layout**: eine zentrierte Spalte, schlanke persistente Statusleiste mit
  Siegel und Pseudonym, flache Flächen mit Haarlinien statt Schattenkarten.
  Erhöht wird nur der Melde-Dialog.

Barrierefreiheit: sichtbarer Fokus auf allem, Tastaturbedienung im ganzen
Flow (Enter sendet, Shift+Enter macht eine Zeile, Escape schliesst den
Dialog über das native `<dialog>`), `aria-live` für Verifizierungsschritte,
Chatverlauf und Speicherstatus, und `prefers-reduced-motion` schaltet
Suchlauf und Tippindikator ab.

## Bewusst nicht im Scope

Video und Audio, echtes Backend, echte Ausweisprüfung, Zahlungen,
Push-Benachrichtigungen, Mehrsprachigkeit der Oberfläche (UI ist deutsch).

## Offene Punkte für Phase 2

### Backend
Identität, Matching, Nachrichtenzustellung und Meldungen gehören auf einen
Server; Nachrichten laufen über WebSocket statt über ein lokales Skript.
Einstiegspunkt ist `src/services/mockApi.ts` – die Signaturen sind so
gewählt, dass sie ein echter Client erfüllen kann.

### Echte Verifizierung – niemals selbst gebaut
Ausweisprüfung und Lebenderkennung kommen von einem spezialisierten Anbieter
(z.B. Veriff, Sumsub, IDnow). Ausweisdaten gehen direkt vom Gerät zum
Anbieter, nie über eigene Server; zurück kommt idealerweise nur „geprüft
ja/nein", ein Altersnachweis und ein stabiler Identifikator. Zu klären:
Anbieterwahl, Kosten pro Prüfung, Wiederholprüfung, Umgang mit
Fehlschlägen, Ausweisdokumente ohne maschinenlesbare Zone, Barrierefreiheit
des Prüfprozesses.

### Datenschutz und Recht
Ausweisdaten sind besonders schützenswert – DSG (CH) und DSGVO (EU) gelten
in vollem Umfang. Zu klären: Rechtsgrundlage und Zweckbindung,
Auftragsverarbeitungsverträge mit dem Prüfanbieter, Speicherort und
-dauer, Löschkonzept und Betroffenenrechte, Datenschutzerklärung und AGB,
Vorgehen bei Behördenanfragen, Protokollierung von Sperrentscheiden,
Meldewege nach DSA (EU) und Impressumspflichten. Diese Punkte sind
juristisch zu begleiten, nicht nebenbei zu lösen.

### Moderation
Serverseitige Klassifikation statt Wortliste, Eskalationsstufen,
Wiederholungstäter-Erkennung, Einspruchsverfahren gegen Sperren,
Aufbewahrungsfristen für Meldeauszüge, echte Rollen- und Rechteverwaltung
für die Moderationsansicht (die im Prototyp offen erreichbar ist), sowie
Kennzahlen für Bearbeitungszeiten.

### Bei Live-Inhalten (Video/Audio, Phase 3)
Dann kommen belastbare Altersprüfung, Aufzeichnungs- und Meldemechanismen
in Echtzeit, Jugendschutzauflagen und je nach Markt weitere regulatorische
Anforderungen hinzu. Das ist ein eigener Themenblock, kein Feature.

### Technisch offen
Mehrsprachige Oberfläche, E2E-Tests für den ganzen Flow (Unit-Tests für
Wortfilter, Storage und `mockApi` liegen vor: `npm run test`),
Rate-Limiting, Missbrauchserkennung beim Matching, Skalierung der
Warteschlange.

## Entwicklung mit Claude Code

`.claude/hooks/session-start.sh` installiert in Web-Sessions die
Abhängigkeiten, damit Build, Lint und Tests sofort laufen. Lokal tut der
Hook nichts.
