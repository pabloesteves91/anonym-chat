# Hosting auf GitHub Pages und eigene Domain

Die App ist eine statische Seite ohne eigenen Server; die Daten liegen bei
Firebase. Gebaut wird mit
`npm run build:static` – Hash-Routing und relative Pfade, damit er sowohl
unter einem Unterpfad (`…github.io/anonym-chat/`) als auch auf einer eigenen
Domain im Wurzelverzeichnis läuft.

## 1. Deployment

`.github/workflows/pages.yml` macht bei jedem Push auf den Default-Branch:
Lint, Typprüfung, Tests, Build, Veröffentlichung. Schlägt einer der Schritte
fehl, geht nichts live.

**Einmalig vorher nötig**, sonst bricht der Workflow im Schritt
`configure-pages` ab: Der Workflow-Token darf die Pages-Site nicht selbst
anlegen (`Resource not accessible by integration`), das geht nur von Hand:

**Settings → Pages → Build and deployment → Source: „GitHub Actions"**

Danach den Workflow erneut starten (**Actions → Pages → Run workflow**) oder
einfach den nächsten Push abwarten. Unter **Actions** den Lauf ansehen; die Adresse steht am Ende des
Deploy-Jobs, üblicherweise:

```
https://pabloesteves91.github.io/anonym-chat/
```

## 2. Eigene Domain

### Domain kaufen
Bei einem beliebigen Registrar. Für ein Schweizer Projekt liegt eine
`.ch`-Domain nahe (Hostpoint, Infomaniak, Gandi); Preis rund 10–20 Franken
im Jahr.

### DNS setzen

**Variante A – Domain ohne Präfix (`beispiel.ch`):** vier A-Records und vier
AAAA-Records auf die Pages-Adressen:

| Typ | Name | Wert |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |

**Variante B – mit Präfix (`chat.beispiel.ch` oder `www.beispiel.ch`):** ein
einziger Eintrag, robuster und bei den meisten Registraren einfacher:

| Typ | Name | Wert |
| --- | --- | --- |
| CNAME | `chat` | `pabloesteves91.github.io.` |

Die IP-Adressen in Variante A ändert GitHub selten, aber nicht nie – vor dem
Eintragen kurz in der GitHub-Dokumentation zu „Managing a custom domain"
gegenprüfen.

### In GitHub eintragen

**Settings → Pages → Custom domain**, Domain eintragen, speichern. GitHub
prüft das DNS (kann bis zu einer Stunde dauern, bei manchen Registraren
länger). Sobald das Zertifikat ausgestellt ist, **„Enforce HTTPS"**
anhaken.

Zusätzlich gehört die Domain in den Build, damit sie ein späteres Deployment
nicht überschreibt:

```bash
echo "chat.beispiel.ch" > public/CNAME
```

## 3. Nach dem Domainwechsel: saubere URLs

Auf einer eigenen Domain liegt die App im Wurzelverzeichnis. Dann lohnt sich
der Wechsel von `beispiel.ch/#/chat` auf `beispiel.ch/chat`:

1. In `src/main.tsx` wieder `BrowserRouter` verwenden (die Umschaltung hängt
   an `VITE_ROUTER`, siehe `.env.static`).
2. Mit `--base /` bauen.
3. `dist/404.html` als Kopie von `dist/index.html` erzeugen – GitHub Pages
   liefert sie bei unbekannten Pfaden aus, womit die App auch bei direktem
   Aufruf von `/chat` lädt.

Vorher nicht: unter `…github.io/anonym-chat/` würden die Pfade brechen.

## Alternative: Firebase Hosting

Schneller als GitHub Pages, wenn die Anmeldung getestet werden soll: Die
Adresse `anonym-chat-223af.web.app` steht bei Firebase **automatisch** auf
der Liste der autorisierten Domains – Google- und Apple-Anmeldung
funktionieren dort ohne weitere Einstellung.

```bash
npm run build          # normaler Build: saubere Pfade, kein Hash-Routing nötig
npx firebase-tools login
npx firebase-tools deploy --only hosting
```

Die Rewrite-Regel in `firebase.json` leitet alle Pfade auf `index.html`, die
App kommt damit ohne `#` aus. Für GitHub Pages bleibt `npm run build:static`
mit Hash-Routing richtig, weil dort keine Rewrites möglich sind.

## Firebase

Ohne Firebase läuft nichts: Anmeldung, Verifizierung, SMS und Chat hängen
daran. Diese Einstellungen müssen in der Konsole stimmen.

### Anmeldearten

**Authentication → Sign-in method**, aktiviert sein müssen:

- **E-Mail/Passwort** – für Anmeldung und Registrierung
- **Google** und **Apple** – die beiden Knöpfe auf der Anmeldeseite
- **Telefon** – für die SMS in der Verifizierung

Fehlt eine davon, meldet die App `auth/operation-not-allowed`. Welche Knöpfe
sie anbietet, steht in `ANMELDEARTEN` in `src/services/firebase.ts`; beides
muss zusammenpassen.

### Freigegebene Domains

**Authentication → Settings → Authorized domains**, dort eintragen:
`pabloesteves91.github.io` und später die eigene Domain. Ohne diesen Eintrag
meldet die Anmeldung `auth/unauthorized-domain` – und die SMS geht ebenfalls
nicht raus, weil die unsichtbare reCAPTCHA-Prüfung an derselben Liste hängt.

### SMS-Kontingent

Firebase Phone Authentication hat ein Freikontingent pro Tag; darüber hinaus
kostet jede SMS. Unter **Authentication → Settings → SMS region policy**
lässt sich einschränken, in welche Länder überhaupt verschickt wird – das ist
die wirksamste Bremse gegen SMS-Betrug. Sinnvoll: nur die Schweiz und die
Nachbarländer freigeben.

Zum Testen ohne echte SMS gibt es **Phone numbers for testing**: Nummer und
fester Code eintragen, dann läuft der Ablauf durch, ohne dass etwas
verschickt wird.

### Ablauffrist der Chats (TTL)

Die 72 Stunden löscht Firestore selbst, aber nur mit einer Richtlinie. **Zum
Klicken gibt es dafür in der Firebase-Konsole nichts** – TTL liegt in der
Google-Cloud-Konsole. Suchen muss man sie trotzdem nicht: Beide Richtlinien
stehen in `firestore.indexes.json` und werden mit den Regeln zusammen
ausgerollt.

```json
"fieldOverrides": [
  { "collectionGroup": "chats",    "fieldPath": "expiresAt", "ttl": true, "indexes": [] },
  { "collectionGroup": "messages", "fieldPath": "expiresAt", "ttl": true, "indexes": [] }
]
```

Die zweite ist leicht zu vergessen und genauso wichtig: Die Nachrichten
liegen in einer Unterkollektion und verschwinden nicht mit dem Raum.

Nachsehen lässt sich das Ergebnis unter
[console.cloud.google.com → Firestore → Time-to-live (TTL)](https://console.cloud.google.com/firestore/databases/-default-/ttl?project=anonym-chat-223af).
Nach dem Anlegen steht eine Richtlinie erst auf „wird erstellt"; bis sie
greift, können ein paar Minuten vergehen. Gelöscht wird danach laufend, aber
nicht auf die Sekunde genau – Firestore räumt in Wellen ab. Für die Zusage
„nach 72 Stunden weg" reicht das; verlassen darf man sich für den Zugriff
trotzdem nicht darauf, deshalb prüfen die Security Rules die Frist zusätzlich
bei jedem Einzelabruf.

### Regeln und Indizes ausrollen

Die Security Rules liegen als `firestore.rules` und `storage.rules` im Repo
und **müssen ausgerollt sein, bevor echte Daten hineingehen**. Ohne sie gilt,
was in der Konsole steht – im Produktionsmodus ist das „alles verboten", und
die App bekommt bei jedem Zugriff „Dafür fehlen die Rechte".

Dazu kommt `firestore.indexes.json`: Die Warteschlange fragt nach Einträgen
ohne Raumnummer, sortiert nach Alter. Ohne den zusammengesetzten Index
scheitert jede Suche mit `failed-precondition`, und Firestore schreibt einen
Link zum Anlegen in die Browserkonsole.

Drei Wege, je nachdem was gerade zur Hand ist.

### A) Von Hand in der Konsole – am schnellsten, ohne Einrichtung

1. Datei im Repo öffnen, Inhalt kopieren:
   [firestore.rules](../firestore.rules)
2. Firebase-Konsole → **Firestore Database → Regeln**, alles ersetzen,
   **Veröffentlichen**.
3. Dasselbe mit [storage.rules](../storage.rules) unter **Storage → Regeln**.
4. Den Index legt die Konsole auf Zuruf an: einmal die Suche starten, in der
   Browserkonsole dem Link aus der Fehlermeldung folgen, **Erstellen**.

Nachteil: Die Konsole und das Repo können auseinanderlaufen. Nach einer
Änderung im Repo also daran denken – oder Weg B nehmen.

### B) Über GitHub Actions – einmal einrichten, dann automatisch

`.github/workflows/firebase-rules.yml` rollt beide Dateien aus, sobald sie
sich ändern, und lässt sich jederzeit von Hand starten. Einmalig nötig:

1. Firebase-Konsole → **Projekteinstellungen → Dienstkonten → Neuen privaten
   Schlüssel generieren**. Es lädt eine JSON-Datei herunter.
2. GitHub → **Settings → Secrets and variables → Actions → New repository
   secret**, Name `FIREBASE_SERVICE_ACCOUNT`, als Wert den **ganzen Inhalt**
   der JSON-Datei einfügen.
3. **Actions → Firebase Rules → Run workflow**.

Die JSON-Datei danach lokal löschen und nirgends sonst ablegen: Sie umgeht
jede Security Rule. Im Secret ist sie richtig aufgehoben, in einem Chat oder
im Repo nicht.

#### Wenn das Ausrollen an Rechten scheitert

```
Error: Request to https://serviceusage.googleapis.com/... had HTTP Error: 403,
Permission denied to get service [firebasestorage.googleapis.com]
```

Der Schlüssel ist dann in Ordnung – dem Dienstkonto dahinter fehlen nur
Rollen. Das aus der Firebase-Konsole erzeugte Konto
(`firebase-adminsdk-…@anonym-chat-223af.iam.gserviceaccount.com`) darf von
Haus aus Daten lesen und schreiben, aber keine Regeln veröffentlichen.

Zu beheben in der **Google-Cloud-Konsole → IAM und Verwaltung → IAM**: beim
Dienstkonto auf den Stift, **Weitere Rolle hinzufügen**, und diese drei
ergänzen:

| Rolle | Wofür |
| --- | --- |
| Firebase Rules Admin | `firestore.rules` und `storage.rules` veröffentlichen |
| Cloud Datastore Index Admin | Indizes und TTL-Richtlinien setzen |
| Service Usage Consumer | die Vorabprüfung, ob die nötigen APIs aktiv sind |

Speichern, dann **Actions → Firebase Rules → Run workflow**. Die Rollen
greifen sofort; ein neuer Schlüssel ist nicht nötig.

Wer es kürzer mag, vergibt stattdessen die Rolle **Firebase Admin** – sie
enthält alle drei. Die Rolle **Editor** funktioniert ebenfalls, gibt dem
Konto aber Zugriff auf das ganze Projekt; für einen Schlüssel, der in einem
Repository-Secret liegt, ist das mehr, als nötig ist.

### C) Lokal, wenn ein Terminal da ist

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage
```

### Emulator für die Entwicklung

```bash
npm run emulator      # Auth, Firestore und Storage lokal
npm run dev:emulator  # Dev-Server, der sie statt Firebase benutzt
```

## Was öffentlich wird

- Das Repository ist öffentlich, der Quellcode also ohnehin einsehbar.
- Mit Pages wird auch die laufende App öffentlich – **inklusive der Route
  `/admin`**. Die Ansicht selbst ist erreichbar, die Daten dahinter nicht:
  Firestore gibt Meldungen, Anträge und Verläufe nur der einen Kennung
  heraus, die in `firestore.rules` steht. Eine Prüfung im Browser wäre
  Anzeige, keine Sicherung.
- `public/robots.txt` lässt Suchmaschinen herein. Die Zeile gegen `/admin`
  greift allerdings nur bei echten Pfaden – auf Pages läuft Hash-Routing,
  die Ansicht steht unter `/#/admin`, und Fragmente sieht kein Crawler. Das
  ist kein Loch: Die Daten schützt `firestore.rules`, nicht diese Datei.
- Kosten entstehen bei Firebase: Lese- und Schreibzugriffe, Dateispeicher
  und vor allem **SMS**. Das Kontingent im Blick behalten, siehe oben.
