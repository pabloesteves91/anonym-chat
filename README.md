# Verifizierter Anonymchat

Zufallschat für Erwachsene. Jede Person weist sich einmal mit Ausweis aus;
im Gespräch bleiben beide Seiten anonym. Der Zweck der Verifizierung ist
nicht, jemanden zu kennen, sondern dafür zu sorgen, dass eine Sperre hält.

**Stand: Echtbetrieb.** Es gibt keine simulierten Gesprächspartner, keine
angezeigten SMS-Codes und keinen Demo-Modus. Wer hier schreibt, schreibt mit
einem anderen Menschen; wer freigegeben wird, wurde von Hand freigegeben.

Was fehlt, steht in [Was noch offen ist](#was-noch-offen-ist) – vor allem
die Kasse für die bezahlten Tarife.

## Schnellstart

```bash
npm install
npm run dev        # http://localhost:5173
npm run lint       # oxlint
npm test           # vitest
npm run build      # Produktionsbuild nach dist/
```

Die App spricht in der Entwicklung mit dem echten Firebase-Projekt. Für einen
abgeschotteten Durchlauf gibt es die Emulatoren, siehe
[docs/deployment.md](docs/deployment.md).

## Wie es funktioniert

### Der Weg einer Person

1. **Konto** – E-Mail und Passwort, Google oder Apple. Das Konto ist die
   Klammer um alles Weitere und taucht im Chat nirgends auf.
2. **Verifizierung** – Mobilnummer per echter SMS bestätigen, Ausweisfoto und
   Selfie hochladen. Die Nummer wird dabei fest mit dem Konto verbunden:
   Firebase lässt dieselbe Nummer kein zweites Mal zu.
3. **Prüfung** – Ein Mensch aus der Moderation sieht sich beide Bilder an und
   entscheidet. Unmittelbar danach werden die Bilder gelöscht.
4. **Chat** – Ein Klick stellt in die Warteschlange. Sobald jemand passt,
   entsteht ein gemeinsamer Raum. Sichtbar ist beidseitig nur das Pseudonym,
   ob die Gegenseite gerade am Gerät ist und ob sie tippt.
5. **Ende** – Mit dem Chat ist der Verlauf für beide weg. Für die Moderation
   bleibt er 72 Stunden lesbar, dann löscht ihn Firestore selbst.

### Wie zwei Browser zueinander finden

Es gibt keinen eigenen Server. Das Zusammenführen machen die Browser deshalb
unter sich aus:

- Wer sucht, legt `queue/{uid}` an – mit Pseudonym, Sprache und Interessen.
  Mehr steht dort nicht, weil die Warteschlange für alle Suchenden lesbar
  sein muss.
- Derselbe Browser liest die Warteschlange, filtert nach beiden Seiten
  (`services/matching.ts`) und versucht, einen Eintrag zu greifen.
- Gegriffen wird in einer Firestore-Transaktion: Sie legt den Raum an und
  trägt die Raumnummer in beide Warteschlangeneinträge ein. Wer zu spät
  kommt, sieht dort schon eine Nummer und probiert es beim Nächsten.
- Alle 20 Sekunden setzt jede Seite ein Lebenszeichen. Einträge, die älter
  als 90 Sekunden sind, gelten als verlassen und werden übersprungen.

Der Nachteil: Wer die Warteschlange lesen darf, sieht, wer gerade sucht.
Deshalb steht dort ausschliesslich, was das Gegenüber gleich ohnehin sieht –
und lesen darf sie nur, wer selbst verifiziert und nicht gesperrt ist.

### Wo die Daten liegen

| Ort | Inhalt | Wer darf lesen |
| --- | --- | --- |
| `users/{uid}` | Pseudonym, Profil, Verifizierungsstand, Tarif | Konto selbst, Moderation |
| `planRequests/{uid}` | Wer welchen Tarif möchte | Konto selbst, Moderation |
| `verifications/{id}` | Antrag mit maskierter Nummer | Konto selbst, Moderation |
| `queue/{uid}` | Wer gerade sucht | alle Suchenden |
| `chats/{roomId}` | Beteiligte, Zähler, Frist | beide Beteiligten, Moderation |
| `chats/{roomId}/messages/{id}` | Die Nachrichten | beide Beteiligten, Moderation |
| `reports/{id}` | Meldungen mit Auszug | Moderation |
| `blocked/{uid}` | Sperren | Moderation (wirkt über die Rules) |
| `accessLog/{id}` | Jeder Blick in einen Verlauf | Moderation, unveränderlich |
| Storage `verifications/{uid}/` | Ausweisfoto und Selfie | Konto selbst, Moderation |

Durchgesetzt wird das in `firestore.rules` und `storage.rules`, nicht im
Browser. Zwei Bedingungen hängen dort an fast allem: Das Konto muss
verifiziert sein, und es darf nicht in `blocked` stehen. Eine gesperrte
Person kommt damit auch dann nicht in die Warteschlange, wenn sie den
Browsercode umschreibt.

## Aufbau des Codes

```
src/
  services/
    api.ts              Die eine Tür zur Datenhaltung
    backend/firestore.ts  Gespeichertes: Konten, Anträge, Meldungen, Verläufe
    backend/live.ts       Laufendes: Warteschlange, Raum, Nachrichten
    backend/shared.ts     ApiError, Fristen, Nummernformate
    phone.ts            SMS-Bestätigung über Firebase Phone Auth
    auth.ts             Anmeldung – für Nutzende und für die Moderation
    matching.ts         Wer zu wem passt (ohne Firestore, damit prüfbar)
    plans.ts            Tarife, Grenzen, Tageszähler
    wordFilter.ts       Wortfilter und Namensprüfung
  store/                Zustand (zustand): session, chat, verification, …
  routes/               Seiten
  components/           Bausteine
  content/legal.ts      Impressum, Datenschutz, Nutzungsbedingungen
```

Komponenten sprechen nie direkt mit Firebase. Sie rufen Aktionen eines
Stores auf, der Store ruft `services/api.ts`, und erst dahinter beginnt
Firestore. Wird der Unterbau getauscht, ändert sich genau eine Datei.

## Sicherheit und Datenschutz

- **Ausweisbilder** sind das Heikelste im System. Sie gehen verschlüsselt an
  den Dateispeicher in `europe-west3`, sind nur für die hochladende Person
  und die Moderation lesbar und werden nach dem Entscheid gelöscht. In
  dauerhaftem Browserspeicher liegen sie nie.
- **Chatverläufe** laufen nach 72 Stunden ab. Die Frist steht als
  `expiresAt` im Dokument; gelöscht wird von zwei TTL-Richtlinien in
  Firestore, nicht von der App. Sie stehen in `firestore.indexes.json` und
  werden mit den Regeln ausgerollt.
- **Jeder Blick** der Moderation in einen Verlauf schreibt einen Eintrag in
  `accessLog`, der sich nicht ändern und nicht löschen lässt.
- **Der Wortfilter** läuft im Browser, schon beim Tippen. Er blockiert nichts,
  sondern warnt vorher und markiert nachher – Filter, die blockieren, werden
  umgangen, Filter, die markieren, geben der Moderation Anhaltspunkte.
- **Die Moderationsansicht** ist für alle anderen nicht vorhanden: Wer ohne
  Rechte auf `/admin` geht, sieht dieselbe Seite wie bei einer Adresse, die
  es nicht gibt – keine Anmeldemaske, die zum Probieren einlädt. Das ist
  Verschleierung, keine Sicherung; die leistet allein `firestore.rules`.

Was nicht ins Repository gehört: der **Dienstkonto-Schlüssel** (umgeht jede
Regel) und der **Apple-.p8-Schlüssel**. Die Firebase-Webkonfiguration
dagegen ist ein öffentlicher Bezeichner und steht bewusst im Code – der
Schutz kommt aus den Rules und der Domainbeschränkung des API-Schlüssels.

## Rollen

Zwei, weil sie Unterschiedliches anrichten können:

| Rolle | Darf | Darf nicht |
| --- | --- | --- |
| **Moderation** | Verifizierungen entscheiden, Meldungen und Verläufe lesen, Konten sperren | Tarife vergeben, Daten löschen |
| **Verwaltung** | alles davon, plus Tarife vergeben und Meldungen/Verläufe zurücksetzen | das Zugriffsprotokoll löschen – das kann niemand |

Beide nutzen den Dienst ohne Tarifgrenzen: unbegrenzt Chats, alle Filter,
eigener Anzeigename. Ein Tageskontingent, das mitten in einer Prüfung
ausgeht, wäre nur im Weg.

### Eine Person hinzufügen

Ihre Kennung (steht in ihrem Profil unter „Kennung dieses Kontos") an
**drei Stellen** eintragen – sie müssen zusammenpassen:

1. `src/services/roles.ts` – `MODERATOR_UIDS` oder `ADMIN_UIDS`, für die Anzeige
2. `firestore.rules` – in `istModeration()` beziehungsweise `istVerwaltung()`
3. `storage.rules` – in `istModeration()`, für die Ausweisbilder

Pushen genügt: Der Ablauf „Firebase Rules" rollt die Regeln aus, sobald sich
eine der Dateien ändert, und führt vorher die Regel-Tests aus. Nur in
`roles.ts` eingetragen heisst: Die Person sieht die Oberfläche und bekommt
vom Server auf jede Abfrage eine Absage.

Sobald es mehr als eine Handvoll Kennungen sind, gehört das auf Custom
Claims umgestellt – eine Liste im Quelltext skaliert nicht, und jede
Änderung braucht ein Deployment.

## Tarife

| Tarif | Preis | Was er ändert |
| --- | --- | --- |
| Frei | CHF 0 | 10 Chats pro Tag, Suche nach Sprache, gewürfelter Name |
| Plus monatlich | CHF 7.90 | unbegrenzt, Interessenfilter, Vorrang, eigener Name |
| Plus jährlich | CHF 69.– | dasselbe, gut ein Viertel günstiger |
| Lifetime | CHF 179.– | dasselbe, einmalig, ohne Ablauf |

Verifizierung, Moderation und Meldewege sind in jedem Tarif gleich. Bezahlt
wird für mehr Gespräche, nicht für mehr Sicherheit.

Details und der Weg zur Kasse: [docs/tarife.md](docs/tarife.md).

## Was noch offen ist

- **Die Kasse.** Bezahlen lässt sich nichts. Eine Zahlung braucht einen
  Server, der die Quittung des Anbieters prüft. Bis dahin hinterlässt eine
  Auswahl auf `/preise` oder im Fenster nach der Anmeldung einen Wunsch, den
  die Moderation unter `/admin` sieht und von Hand freischaltet.
- **Die Tagesgrenze** wird im Browser geprüft. Wer den Code umschreibt,
  umgeht sie. Ein Riegel wird daraus erst mit einer Serverfunktion.
- **Das Zugriffsprotokoll** schreibt der Client. Wer Moderationsrechte hat,
  könnte den Eintrag umgehen. Auch das gehört auf die Serverseite.
- **Verlassene Räume** werden nicht aufgeräumt, sie laufen nur ab. Bei mehr
  Verkehr lohnt sich eine geplante Funktion, die Warteschlange und leere
  Räume putzt.
- **Die Rollenlisten** stehen im Quelltext und in den Regeln. Jede neue
  Person braucht ein Deployment; ab einer Handvoll gehört das auf Custom
  Claims umgestellt.
- **Die Rechtstexte** enthalten Platzhalter (mit ⚠︎ markiert) und sind nicht
  juristisch geprüft.

## Weiterführend

- [docs/deployment.md](docs/deployment.md) – Auslieferung, Firebase-Konsole,
  Rules und Indizes ausrollen
- [docs/tarife.md](docs/tarife.md) – Tarifmodell und was die Kasse braucht
- [docs/testrunde.md](docs/testrunde.md) – Durchlauf zu zweit
