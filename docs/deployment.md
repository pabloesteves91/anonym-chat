# Hosting auf GitHub Pages und eigene Domain

Der Prototyp ist eine rein statische Seite ohne Server. Gebaut wird mit
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

Die Anmeldung für die Moderation läuft über Firebase Auth. Damit sie auf der
veröffentlichten Seite funktioniert, muss die Domain in der Firebase-Konsole
freigegeben sein:

**Authentication → Settings → Authorized domains**, dort eintragen:
`pabloesteves91.github.io` und später die eigene Domain.

Ohne diesen Eintrag meldet die Anmeldung `auth/unauthorized-domain`.

Die Security Rules liegen als `firestore.rules` und `storage.rules` im Repo
und werden mit der Firebase CLI ausgerollt:

```bash
npx firebase-tools deploy --only firestore:rules,storage
```

## Was öffentlich wird

- Das Repository ist öffentlich, der Quellcode also ohnehin einsehbar.
- Mit Pages wird auch die laufende App öffentlich – **inklusive der Route
  `/admin`**. Das ist unkritisch, weil dort nur Daten aus dem Browser der
  betrachtenden Person stehen, und die Ansicht sagt es selbst. Zugesperrt
  wird sie später an einer einzigen Stelle: `getModeratorAccess()` in
  `src/services/auth.ts`.
- `public/robots.txt` hält Suchmaschinen fern, solange es ein Prototyp ist.
- Es gibt weiterhin keinen Server: keine Anmeldung, keine Daten, keine
  Kosten ausser der Domain.
