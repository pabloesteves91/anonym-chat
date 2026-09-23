# Rund ums Gespräch

Feedback, automatischer Hinweis, Statistik, Gesprächsstarter, Suche und
Sicherheitsmenü: was es gibt, wo es liegt, was sich einstellen lässt.

## Feedback nach dem Chat

Nach dem Ende (selbst beendet, Gegenüber gegangen, „Nächste Person")
erscheint freiwillig: 👍 Gutes Gespräch · 😐 Neutral · 👎 Unangenehm ·
Überspringen. Nach Melden oder „Nicht mehr verbinden" wird nicht gefragt.

- Gespeichert: `feedback/{raum}_{konto}` = `chatId, von, ueber, wert, at, expiresAt`.
  Einmal pro Gespräch und Konto; ändern und löschen darf niemand. Nach 7 Tagen
  löscht Firestore die Bewertung (TTL auf `expiresAt`).
- Lesen: nur die bewertende Person selbst und die Moderation. Die bewertete
  Person erfährt nie davon. Es gibt keine Punkte, Sterne oder Ranglisten.

## Automatischer Hinweis an die Moderation

Ausgewertet wird auf dem Server (`feedbackAuswerten`, Logik in
`functions/src/schwelle.ts`), nie im Browser:

- Erst **drei „unangenehm" von drei verschiedenen Personen aus drei
  verschiedenen Gesprächen** ergeben einen Hinweis. Gezählt wird nur, wenn der
  Raum beiden gehört und darin geschrieben wurde.
- Der Hinweis landet als Eintrag in `reports` (`reporterId: 'system'`, Feld
  `automatisch`) in derselben Liste wie Meldungen, deutlich markiert. In
  Discord erscheint er als „🤖 Automatischer Hinweis".
- **Gesperrt wird nie automatisch.** Die Moderation entscheidet wie bei jeder Meldung.
- Danach beginnt der Zähler von vorn. Die vierte Bewertung erzeugt keinen
  zweiten Fall, sondern erst drei weitere, neue Personen. Wer schon zu einem
  Fall beigetragen hat, zählt für dasselbe Konto nicht noch einmal.
- Der Stand liegt in `feedbackStand/{konto}`; dort kommt nur der Server hin.
- Einstellbar in `functions/src/schwelle.ts`: `SCHWELLE` (3) und
  `FENSTER_MS` (90 Tage; ältere Bewertungen verfallen).

## Deine NØNE Statistik (Profil)

Gespräche insgesamt, diesen Monat, Zeit im Gespräch, längstes Gespräch,
Durchschnitt und erhaltene „Gutes Gespräch". Nichts über „unangenehm",
Meldungen oder den Moderationsstand.

- `statistik/{konto}`: lesen nur die Person selbst, schreiben nur der Server.
- Gezählt wird einmal pro Raum und egal wie das Gespräch endete. Beim Verlassen
  legt die App `gespraechsende/{raum}` an, daraufhin zählt `gespraechGezaehlt`
  für beide Seiten. Ein Raum, der nie beendet wurde (beide Fenster zu), zählt
  beim Ablauf der 72 Stunden (`gespraechVerfallen`).
- Die Dauer kommt aus der Serverzeit, nicht aus der Uhr des Browsers.

## Suche

- **Keine Zahlen in der Warteschlange**, nur eine Stufe in Worten
  (`suchstatus` in `src/services/matching.ts`).
- **Suche erweitern:** Wer mit Interessenfilter sucht, wird nach
  `ERWEITERUNG_ANGEBOT_NACH_MS` (45 s) gefragt: „Ohne Interessenfilter
  weitersuchen?". Ohne Zustimmung ändert sich nichts. „Weiter warten" fragt
  frühestens nach `ERWEITERUNG_ERNEUT_NACH_MS` (60 s) wieder. Die Sprache
  bleibt immer, und die Erweiterung gilt nur für diese eine Suche.
- **„Nicht mehr verbinden" gilt jetzt beim Zusammenführen.** Vorher stand es
  nur in der Liste. Heute filtert die App die eigene Liste, und die Security
  Rules lehnen einen Raum ab, wenn einer der beiden den anderen ausgeschlossen hat.
- **Nächste Person:** beendet sauber und sucht sofort mit denselben Filtern
  weiter. Das Tageslimit gilt wie bei jeder Suche.

## Im Chat

- **NØNE Vorschläge:** 70 Gesprächsstarter in `src/content/gespraechsstarter.ts`.
  Es werden drei gezeigt, „Andere Vorschläge" lädt neue. Ein Klick setzt den
  Satz ins Eingabefeld, gesendet wird er nie von selbst.
- **Sicherheit:** Chat verlassen · Nicht mehr verbinden · Melden & verlassen
  (bestehende Meldung: Chat endet, Konto wird nicht mehr zugelost, die
  Moderation bekommt den Fall).

## Interessen

Interessen gibt es nur in der Suche (mit Plus), nicht mehr im Profil. Wer mit
Interessen sucht, trifft andere, die mit mindestens einem gleichen Interesse
suchen. Zur Auswahl stehen 40 Begriffe in 7 Gruppen (`INTEREST_GRUPPEN` in
`src/services/types.ts`). Die Gruppen dienen nur der Anzeige, die zwölf
bisherigen Begriffe sind unverändert dabei. Es bleibt bei höchstens fünf und
ohne Freitext. Früher gespeicherte Profil-Interessen werden nicht mehr
verwendet und beim nächsten Speichern des Profils entfernt.
