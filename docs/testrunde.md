# Durchlauf zu zweit

Der Chat verbindet zwei echte Menschen. Allein lässt er sich deshalb nicht
prüfen – es braucht zwei Konten, und beide müssen verifiziert sein.

## Vorbereitung

1. **Zwei Konten anlegen.** Direkt nach der Registrierung fragt ein Fenster
   nach dem Geschlecht – es lässt sich nicht überspringen und bestimmt die
   Form des Anzeigenamens. Für den Durchlauf am besten eines je Form, dann
   sieht man beide Varianten. Zwei verschiedene E-Mail-Adressen, oder eines per
   E-Mail und eines über Google. Zwei Browser oder ein normales und ein
   privates Fenster; in zwei Tabs desselben Fensters teilen sich beide
   dieselbe Anmeldung.
2. **Zwei Mobilnummern.** Firebase verbindet jede Nummer fest mit einem
   Konto und lässt sie kein zweites Mal zu – das ist der Sinn der Sache, aber
   beim Testen unpraktisch. Abhilfe: In der Firebase-Konsole unter
   **Authentication → Settings → Phone numbers for testing** zwei Nummern mit
   festem Code eintragen. Dann geht keine SMS raus und beide Konten kommen
   durch.
3. **Beide freigeben.** Mit der Moderationskennung `/admin` öffnen, unter
   „Offene Anträge" beide Anträge ansehen und freigeben. Das ist kein
   Testschritt, den man überspringen kann: Ohne Freigabe verweigern die
   Security Rules sogar den Eintrag in die Warteschlange.

## Der Durchlauf

| Schritt | Fenster A | Fenster B | Erwartet |
| --- | --- | --- | --- |
| 1 | „Chat starten" | – | A wartet, Zähler läuft |
| 2 | – | „Chat starten" | Beide landen binnen Sekunden im selben Raum |
| 3 | tippt | – | B sieht „schreibt …" |
| 4 | sendet | – | Nachricht erscheint bei beiden |
| 5 | – | Tab schliessen | A sieht nach ~70 s „gerade nicht am Gerät" |
| 6 | – | zurückkommen, „Chat beenden" | A sieht „Dein Gegenüber hat den Chat beendet" |

Passt nichts zusammen, liegt es fast immer am Filter: Stehen bei beiden
Interessen, muss mindestens eines übereinstimmen – und zwar beidseitig.
Im Gratistarif ist der Interessenfilter ohnehin aus.

## Was danach zu prüfen ist

- **Moderation.** `/admin` zeigt den Raum unter „Chatverläufe" mit der
  Anzahl Nachrichten und der Restlaufzeit. „Verlauf öffnen" zeigt beide
  Seiten mit Pseudonym – und schreibt unten einen Eintrag ins
  Zugriffsprotokoll. Genau das ist der Punkt: Mitlesen geht, aber nicht
  unbemerkt.
- **Melden.** Im Chat „Melden", Grund wählen, absenden. Der Vorgang
  erscheint in `/admin` mit Auszug. Status auf „Gesperrt" setzen: Das
  gemeldete Konto steht danach in `blocked` und kommt nicht mehr in die
  Warteschlange – die Rules lassen es nicht mehr hinein.
- **Wortfilter.** Eine Nachricht mit einem schweren Treffer tippen (etwa
  eine Aufforderung zu Bildern). Vor dem Senden erscheint eine Warnung, der
  Knopf verlangt einen zweiten, bewussten Klick, und in der Moderation ist
  die Nachricht markiert.
- **Tagesgrenze.** Im Gratistarif nach zehn begonnenen Chats erscheint der
  Hinweis auf die Tarifseite. Aufheben lässt sie sich in `/admin` unter
  „Tarif vergeben".
- **Ablauf.** Die 72 Stunden lassen sich nicht abwarten. Stattdessen in der
  Firestore-Konsole bei einem Raum `expiresAt` in die Vergangenheit setzen:
  Der Verlauf verschwindet aus der Übersicht, und ein Einzelabruf wird von
  den Rules abgelehnt.

## Häufige Stolpersteine

| Meldung | Ursache |
| --- | --- |
| „Dafür fehlen die Rechte" | Konto nicht freigegeben, oder Rules nicht ausgerollt |
| `auth/unauthorized-domain` | Domain fehlt in **Authentication → Authorized domains** |
| `auth/operation-not-allowed` | Anmeldeart in der Konsole nicht aktiviert |
| Suche findet nie jemanden | Index fehlt (`firestore.indexes.json`), oder Filter zu eng |
| SMS kommt nicht an | Regionssperre, Kontingent erschöpft, oder Testnummer nicht eingetragen |
