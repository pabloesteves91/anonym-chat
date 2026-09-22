# Sicherheit: Stand, Prüfungen, offene Punkte

Stand: 22. September 2026

Dieses Dokument sagt, was geprüft ist, wie geprüft wurde und was offen ist.
Es ist bewusst unbequem geschrieben – ein Sicherheitsdokument, das nur die
guten Seiten aufzählt, ist wertlos.

## Was *nicht* geprüft wurde

**Es gab keinen Angriff auf die laufende Seite.** Kein Pentest, kein Scan
gegen `pabloesteves91.github.io`, keine Versuche gegen die echte Firebase-
Instanz. Zwei Gründe: Die Entwicklungsumgebung kommt netzseitig weder an
`github.io` noch an die Google-APIs heran, und ein Angriff auf die
Produktivdaten wäre auch mit Zugang die falsche Reihenfolge.

Was stattdessen existiert, ist eine **Angriffssuite gegen die Security Rules**,
die lokal gegen den Firestore-Emulator läuft. Sie prüft nicht, ob die App
funktioniert, sondern ob sie sich umgehen lässt.

```
npm run test:rules      # braucht den Firestore-Emulator
```

48 Prüfungen, alle grün. Darunter:

- fremdes Konto lesen – abgewiesen
- sich selbst auf `verifiziert` setzen – abgewiesen
- sich selbst einen bezahlten Tarif setzen – abgewiesen
- gesperrtes Konto in die Warteschlange – abgewiesen
- fremden Chat lesen oder darin schreiben – abgewiesen
- im Namen einer anderen Person schreiben – abgewiesen
- eine abgeschickte Nachricht nachträglich ändern – abgewiesen
- das Zugriffsprotokoll löschen, auch als Verwaltung – abgewiesen

## Warum die Regeln der eigentliche Schutz sind

Die App hat keinen eigenen Server. Alles, was der Browser tut, kann jemand
nachbauen, der die Browserkonsole öffnet – die Firebase-Konfiguration ist
öffentlich und soll es sein. **Jede Prüfung, die nur im Browser stattfindet,
ist keine Prüfung.** Verlässlich ist ausschliesslich, was in
`firestore.rules` und `storage.rules` steht.

Deshalb gilt die Regel: Wer eine Bedingung in den Client schreibt, schreibt
sie auch in die Regeln – oder markiert sie im Code ausdrücklich als Bremse,
nicht als Riegel.

## Was im Betrieb gut abgesichert ist

- **Ausweisfotos und Selfies** liegen in `verifications/{uid}/` im Storage.
  Schreiben darf nur die Person selbst, lesen nur sie und die Moderation,
  löschen nur die Moderation. Alle anderen Pfade sind vollständig gesperrt.
  Im Browser liegen die Bilder nur im `sessionStorage` – sie überleben einen
  Reload, aber nicht das Schliessen des Browsers.
- **Die Mobilnummer** steht im eigenen Konto und im Verifizierungsantrag,
  nie in der Warteschlange und nie im Chatraum. Das Gegenüber sieht sie nicht.
- **Der Prüfstand** hängt an einem einzigen Feld (`verificationStatus`), das
  niemand an sich selbst vergeben kann. Ein zweites Feld daneben hatte genau
  diesen Fehler und wurde entfernt.
- **Sperren** werden serverseitig in `darfChatten()` durchgesetzt, nicht im
  Browser. Wer gesperrt ist, kommt auch mit umgeschriebenem Code nicht in
  die Warteschlange.
- **Verläufe** verschwinden nach 72 Stunden durch zwei TTL-Richtlinien.
  Die Moderation kommt nach Ablauf der Frist nicht mehr heran.
- **Kein XSS-Vektor** im Code: kein `dangerouslySetInnerHTML`, kein
  `innerHTML`, kein `eval`. React maskiert Nachrichtentexte selbst.

## Offene Punkte, nach Dringlichkeit

### 1. App Check ist nicht eingeschaltet (hoch)

Ohne App Check kann jedes Skript mit dem öffentlichen API-Schlüssel gegen
die Datenbank und gegen den SMS-Versand laufen. Die Regeln halten die Daten
weiterhin dicht, aber sie halten niemanden davon ab, Anfragen zu erzeugen –
und SMS kosten Geld. Das ist die einzige offene Stelle, die direkt Geld
kosten kann.

Einzuschalten in der Firebase-Konsole (App Check → reCAPTCHA Enterprise für
das Web), dazu ein Kostenalarm im Google-Cloud-Budget.

### 2. Für `storage.rules` gibt es keine automatischen Tests (mittel)

Die Regeln für die Ausweisbilder sind gelesen und geprüft, aber nicht durch
Tests abgesichert – der Storage-Emulator lässt sich in dieser Umgebung nicht
starten. Ausgerechnet die heikelsten Daten hängen damit an einer Regel, die
nur durch Hinschauen verifiziert ist. Auf einem Rechner mit Java und freiem
Netzzugang liesse sich dieselbe Suite dafür nachziehen.

### 3. Die Warteschlange ist für alle Suchenden lesbar (mittel, bewusst)

Ohne eigenen Server findet sich sonst niemand. Wer gerade sucht, kann
deshalb die Liste aller anderen Suchenden lesen: Konto-ID, Pseudonym,
Sprache, Interessen. Keine Nummer, keine E-Mail-Adresse, keine Adresse.
Wer mitschreibt, kann über die Zeit erfassen, welche Konto-ID wann online
ist. Das lässt sich nur mit einer Serverfunktion beheben, die das Zusammen-
führen übernimmt.

### 4. Das Zugriffsprotokoll schreibt der Client (mittel)

Beim Öffnen eines Verlaufs legt die App einen Protokolleintrag an. Ändern
und löschen kann ihn niemand, auch die Verwaltung nicht. Aber: Wer
Moderationsrechte hat und den Browsercode umgeht, kann den Eintrag
weglassen. Das Protokoll ist damit gegen nachträgliche Manipulation
gesichert, nicht gegen Unterlassung. Gehört mit einer Cloud Function auf
die Serverseite.

### 5. Das Tageslimit gilt nur im Browser (niedrig)

`registerChatStart()` zählt mit und bremst – umgehen lässt es sich. Das ist
im Code auch so kommentiert. Solange die Kasse aus ist, kostet es nichts;
mit der Kasse gehört die Zählung auf den Server.

### 6. Meldungen sind nicht begrenzt (niedrig)

Jedes angemeldete Konto kann beliebig viele Meldungen anlegen. Das
überschwemmt im schlimmsten Fall die Moderationsübersicht. Auffällig wäre
es sofort, weil alle Meldungen dieselbe Konto-ID tragen.

## Zwei Lücken, die am 22. September geschlossen wurden

Beide sind beim Durchgehen der Regeln aufgefallen, nicht durch einen Angriff.

**Erfundene Chaträume.** Die Regeln erlaubten jedem verifizierten Konto,
einen Chatraum mit einer beliebigen zweiten Person anzulegen – auch mit
einer, die nie gesucht hatte. Darin liess sich im eigenen Namen schreiben
und der Raum anschliessend melden; die Moderation hätte ein Gespräch
vorgelegt bekommen, das nie stattgefunden hat, samt echtem Gegenüber, das
davon nichts weiss. Jetzt verlangt die Regel, dass **beide** Beteiligten in
der Warteschlange stehen.

**Blockierte Warteschlangeneinträge.** Um sich zu finden, darf ein Suchender
im fremden Eintrag ein einziges Feld setzen: die Raumnummer. Eine erfundene
Nummer setzte das Gegenüber dauerhaft fest – der Eintrag galt als vergeben,
niemand griff ihn mehr, und die eigene Suche brach ab. Zwei Änderungen:
Eintragen darf nur noch, wer selbst in der Warteschlange steht, und die App
erkennt eine Raumnummer ohne passenden Raum, setzt sie zurück und sucht
weiter. Ganz verhindern lässt sich das in den Regeln nicht – in einer
Transaktion sieht `get()` den Raum noch nicht, den dieselbe Transaktion
anlegt.

## Vor dem öffentlichen Start

- [ ] App Check einschalten, Kostenalarm setzen
- [ ] API-Schlüssel in der Google-Cloud-Konsole auf die eigene Domain begrenzen
- [ ] Betreiberangaben in `src/content/legal.ts` eintragen (7 Platzhalter)
- [ ] Rechtstexte einmal juristisch prüfen lassen – es werden Ausweisdaten bearbeitet
- [ ] `storage.rules` auf einem Rechner mit Emulator durchtesten
