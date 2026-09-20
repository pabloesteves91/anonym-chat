# Verifizierter Anonymchat – Prototyp (Phase 1)

Zufalls-Textchat, bei dem sich alle Teilnehmenden einmal ausweisen müssen:
Mobilnummer per SMS, Foto des Ausweises, Selfie damit – freigegeben wird von
Hand durch die Moderation. Gegenüber anderen bleibt man anonym, gegenüber dem
System nicht. Genau deshalb wirkt eine Sperre dauerhaft und nicht nur bis zum
nächsten Konto.

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
| Onboarding | Startseite mit Konzept, Antrag in fünf Schritten (Mobilnummer, SMS-Code, Ausweisfoto, Selfie, Absenden), Status in `localStorage` |
| Manuelle Freigabe | Antrag geht in eine Warteschlange; ein Mensch sieht beide Bilder und entscheidet über Freigabe oder Ablehnung mit Begründung. Nichts wird automatisch verifiziert |
| Profil | Zufälliges Pseudonym („Blauer Falke 4417"), Sprache, Altersgruppe, bis zu fünf Interessen – nur fürs Matching |
| Matching | Optionaler Filter, Warteschlange mit Suchlauf, Treffer nach 1–3 s, Fall „niemand passendes erreichbar" |
| Chat | Textchat mit Tippindikator, Skript-Antworten, „Nächster Chat", „Chat beenden", „Melden" |
| Chatverläufe | Jeder beendete Chat liegt 72 Stunden im Moderationsspeicher und läuft dann von selbst ab; Öffnen und Löschen werden protokolliert |
| Moderation | Lokaler Wortfilter (markiert, blockiert nicht), Warnung vor dem Senden bei schweren Treffern, Melde-Dialog mit fünf Gründen und Freitext, Moderationsansicht unter `/admin` |
| Selbstschutz | Verhaltenskodex einmalig vor dem ersten Chat, „Nicht mehr verbinden" blockiert ein Konto nur für einen selbst (ohne Meldung), Übersicht und Aufhebung im Profil |

Zwei Arten von Ausschluss, bewusst getrennt:

- **Sperre durch die Moderation** – Folge einer Meldung, gilt systemweit und
  ist im Prototyp unter `/admin` sichtbar.
- **Eigene Blockierung** – betrifft nur das eigene Matching, die Moderation
  erfährt nichts davon. Wer meldet, blockiert automatisch mit.

### Chatverläufe und Aufbewahrung

Für die Chattenden ist der Verlauf mit dem Beenden weg – weder die eigene
noch die andere Seite kann etwas nachlesen. Beim Beenden wandert er einmal in
den **Moderationsspeicher**, wo er nach **72 Stunden automatisch abläuft**.
Die Frist wird bei jedem Lesezugriff durchgesetzt, nicht nur beim Schreiben:
abgelaufene Verläufe verschwinden auch dann, wenn die App tagelang nicht
offen war.

Die Moderation kann diese Verläufe unter `/admin` öffnen – bei Spamverdacht,
nach einer Meldung, bei Filtertreffern. **Jedes Öffnen und jedes Löschen wird
protokolliert** und ist in derselben Ansicht sichtbar. Die blosse Übersicht
(wer mit wem, wie viele Nachrichten, wie viele Filtertreffer) erzeugt keinen
Eintrag, das Öffnen des Inhalts schon.

Das ist bewusst so gebaut: Ein Moderationsteam, das jedes Gespräch ohne
Anlass mitlesen kann, braucht eine Spur, die zeigt, wer wann was angesehen
hat. Im Prototyp ist das eine Liste in localStorage; im Betrieb wären es
Rollen, ein unveränderliches Protokoll und ein Vier-Augen-Prinzip.

### Der Verifizierungsweg

1. **Mobilnummer** – wird normalisiert (`079 …` → `+4179…`) und geprüft.
2. **SMS-Code** – sechsstellig, zehn Minuten gültig, drei Versuche. Im
   Prototyp geht keine SMS raus: der Code steht im UI.
3. **Ausweisfoto** und **Selfie mit Ausweis** – beide Bilder werden im Browser
   auf 720 px verkleinert (`src/services/image.ts`).
4. **Absenden** – Status `wartet`, der Chat bleibt gesperrt.
5. **Entscheid** – unter `/admin` sieht die Moderation beide Bilder und gibt
   frei oder lehnt mit Begründung ab. Erst das setzt `verifiziert`.

Bei Ablehnung kann mit besseren Aufnahmen neu eingereicht werden.

### Wo die Bilder liegen

Die Originaldateien verlassen das Gerät nicht. Verarbeitet wird nur die
verkleinerte Vorschau, und die liegt im **`sessionStorage`** – sie übersteht
einen Reload im selben Tab, aber weder einen Browserneustart noch den Wechsel
in ein anderes Fenster. Nach dem Entscheid werden beide Bilder gelöscht. In
den Antragsdaten in `localStorage` stehen nur Metadaten (Dateiname, Grösse,
Typ), nie Bilddaten.

Ausweisbilder gehören nicht in dauerhaften Browserspeicher – der Prototyp
macht diese Grenze bewusst sichtbar: Nach einem Browserneustart zeigt die
Prüfansicht statt des Bildes den Hinweis, dass es weg ist.

### Doppelrolle im Prototyp

Da alles lokal läuft, ist dieselbe Person Antragsteller **und** Moderation.
In der echten Version sind das zwei getrennte Rollen mit getrennten Zugängen;
die Bilder lägen nie im Browser des Antragstellers.

## Architektur

```
src/
  routes/       Landing · Verify · Profile · Chat · Admin · NotFound
  components/   AppShell, Lobby, Queue, ChatRoom, MessageList, Composer,
                ReportDialog, CodexDialog, Dialog, VerifiedBadge,
                ThemeToggle, ui
  services/     mockApi.ts   ← einzige "Backend"-Grenze
                auth.ts      ← einzige Stelle für den Moderationszugang
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
Chatverläufe mit Ablaufzeitpunkt, Zugriffsprotokoll, Kodex-Bestätigung,
Themenwahl. Jeder Zugriff ist
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

### SMS-Versand
Ein Gateway (Twilio, MessageBird, Swisscom) ersetzt den angezeigten Demo-Code.
Zu klären: Kosten pro SMS, Rate-Limiting gegen SMS-Pumping, Sperrlisten für
Wegwerf- und VoIP-Nummern, Länderabdeckung, Zustellprobleme, und ob eine
Nummer pro Person erzwungen wird (sie ist der stärkste Wiedererkennungsanker).

### Manuelle Prüfung im Betrieb
Die Prüfung von Hand ist eine bewusste Entscheidung – sie braucht aber
Werkzeug und Regeln: Prüfoberfläche mit Zugriffsprotokoll, Vier-Augen-Prinzip
bei Ablehnungen, Schulung der Prüfenden, Reaktionszeiten und Bereitschaft,
Umgang mit Rückfragen, Einspruch gegen eine Ablehnung, Stichproben zur
Qualitätssicherung. Bilder gehören in einen verschlüsselten Speicher mit
enger Zugriffskontrolle und automatischer Löschfrist (üblich: Löschung
unmittelbar nach dem Entscheid, nur Prüfvermerk bleibt).

Bei grösseren Mengen lässt sich die Prüfung mit einem spezialisierten
Anbieter (Veriff, Sumsub, IDnow) kombinieren: automatische Vorprüfung,
manuell nur die unklaren Fälle. Selbst gebaut wird die Dokumentenprüfung in
keinem Fall.

### Datenschutz und Recht
Ausweisdaten und biometrische Aufnahmen sind besonders schützenswert – DSG
(CH) und DSGVO (EU) gelten in vollem Umfang, und ein Selfie zum Abgleich ist
biometrische Verarbeitung. Zu klären: Rechtsgrundlage und Zweckbindung,
Auftragsverarbeitungsverträge mit SMS-Gateway und Prüfanbieter, Speicherort
und -dauer, Löschkonzept und Betroffenenrechte, Datenschutzerklärung und AGB,
Vorgehen bei Behördenanfragen, Protokollierung von Sperrentscheiden,
Meldewege nach DSA (EU) und Impressumspflichten. Diese Punkte sind
juristisch zu begleiten, nicht nebenbei zu lösen.

### Aufbewahrung der Chatverläufe
Die 72-Stunden-Frist ist im Prototyp eine Zahl in `mockApi.ts`; im Betrieb
braucht sie Infrastruktur: Verschlüsselung im Ruhezustand, ein Löschjob, der
unabhängig von Nutzerzugriffen läuft, Zugriffskontrolle nach Rollen und ein
Protokoll, das die Moderation nicht selbst verändern kann. Dazu die
rechtliche Seite: Inhalte privater Kommunikation sind besonders heikel,
Nutzer haben ein Auskunftsrecht auf das, was über sie gespeichert ist – auch
auf Nachrichten des Gegenübers –, und was aufbewahrt wird, kann von Behörden
herausverlangt werden. Ob als Kommunikationsdienst zusätzlich Pflichten aus
dem BÜPF-Umfeld greifen, gehört anwaltlich abgeklärt. Ende-zu-Ende-
Verschlüsselung ist mit dieser Moderationsform nicht vereinbar; das ist eine
bewusste Entscheidung, keine Lücke.

### Zugang zur Moderation
`/admin` verlangt eine Anmeldung über Firebase Auth. Berechtigt ist genau
eine Kennung (`MODERATOR_UID` in `src/services/firebase.ts`); jedes andere
Konto wird nach der Anmeldung sofort wieder abgemeldet. Anmeldearten:
E-Mail/Passwort und Google, Apple vorbereitet – welche davon angeboten
werden, steht in `ANMELDEARTEN` und muss mit der Firebase-Konsole
übereinstimmen.

Der Moderationsbereich wird als eigener Chunk nachgeladen (`AdminArea`), das
Firebase-SDK landet also nicht im Bundle für normale Nutzer.

Zu beachten: Eine Prüfung im Browser ist eine Anzeige, keine Sicherung.
Solange alle Daten lokal liegen, ist das unkritisch. Sobald sie in Firestore
stehen, entscheiden die Security Rules (`firestore.rules`, `storage.rules`) –
und nur die. Beide Dateien liegen im Repo und sind auf dieselbe UID gemünzt.

Die Firebase-Konfiguration steht offen im Quellcode. Das ist bei Web-Apps
richtig so: Sie ist ein öffentlicher Bezeichner, kein Geheimnis. Der
Service-Account-Schlüssel dagegen gehört nie ins Repo.

### Freigabe im Demo-Modus
Solange die Anträge nur im Browser der antragstellenden Person liegen, sieht
die Moderation sie gar nicht. Damit der Prototyp trotzdem durchspielbar
bleibt, kann man sich auf der Warteseite selbst freigeben – deutlich als
Demo-Weg gekennzeichnet. Er entfällt, sobald die Anträge in Firestore
stehen.

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

## Hosting

`npm run build:static` erzeugt eine rein statische Seite. Der Workflow
`.github/workflows/pages.yml` baut und veröffentlicht sie bei jedem Push auf
den Default-Branch über GitHub Pages – Lint, Typprüfung und Tests laufen
vorher. Einrichtung, eigene Domain und DNS-Einträge stehen in
`docs/deployment.md`.

## Testrunde

`docs/testrunde.md` enthält Aufgaben, Fragebogen und Auswertungsraster für
Tests mit echten Personen. In der App gibt es beim Ausweisfoto und beim
Selfie den Knopf „Demo-Bild einsetzen" – für einen Prototyp-Test soll
niemand ein echtes Dokument hochladen.

## Entwicklung mit Claude Code

`.claude/hooks/session-start.sh` installiert in Web-Sessions die
Abhängigkeiten, damit Build, Lint und Tests sofort laufen. Lokal tut der
Hook nichts.
