/**
 * NØNE Vorschläge – Gesprächsstarter für den Chat.
 *
 * Lokal, ohne Server, ohne Zufallsdienst. Ein Vorschlag wird nur in das
 * Eingabefeld gesetzt, nie von selbst gesendet.
 *
 * Was hier nie hineingehört: Sexuelles, Beleidigendes, Fragen nach Name,
 * Wohnort, Alter, Arbeitgeber oder Kontaktdaten, und alles, was auf eine
 * andere Plattform lockt. Die Anonymität gilt auch für die Fragen, die wir
 * vorschlagen. Ein Test prüft jede Zeile mit dem Wortfilter.
 */

export type StarterKategorie =
  | 'locker'
  | 'lustig'
  | 'persoenlich'
  | 'deep'
  | 'alltag'
  | 'interessen'
  | 'hypothetisch'

export const KATEGORIE_LABEL: Record<StarterKategorie, string> = {
  locker: 'Locker',
  lustig: 'Lustig',
  persoenlich: 'Persönlich',
  deep: 'Deep Talk',
  alltag: 'Alltag',
  interessen: 'Interessen',
  hypothetisch: 'Was wäre, wenn',
}

export interface Starter {
  kategorie: StarterKategorie
  text: string
}

const liste = (kategorie: StarterKategorie, texte: string[]): Starter[] => texte.map((text) => ({ kategorie, text }))

export const GESPRAECHSSTARTER: Starter[] = [
  ...liste('locker', [
    'Wie läuft dein Tag bisher?',
    'Was hat dich heute zum Lächeln gebracht?',
    'Kaffee, Tee oder etwas ganz anderes?',
    'Worauf freust du dich diese Woche?',
    'Welches Lied hörst du gerade rauf und runter?',
    'Was war das Beste, das du diese Woche gegessen hast?',
    'Bist du eher Morgenmensch oder Nachteule?',
    'Wie würdest du deine Stimmung gerade als Wetter beschreiben?',
    'Was machst du am liebsten an einem freien Nachmittag?',
    'Welche kleine Sache hat deinen Tag heute besser gemacht?',
  ]),
  ...liste('lustig', [
    'Welches Essen findest du völlig überbewertet?',
    'Was ist die seltsamste Angewohnheit, die du hast?',
    'Wenn dein Leben eine Serie wäre, wie hiesse die aktuelle Folge?',
    'Welches Tier wäre der schlechteste Mitbewohner?',
    'Was ist das Nutzloseste, das du wirklich gut kannst?',
    'Welcher Ohrwurm lässt dich einfach nicht los?',
    'Was ist dein peinlichster, aber harmloser Fehlkauf?',
    'Wenn Pflanzen reden könnten, welche wäre am frechsten?',
    'Welches Wort findest du einfach lustig?',
    'Ananas auf Pizza: Ja, nein oder egal?',
  ]),
  ...liste('persoenlich', [
    'Was hast du in letzter Zeit Neues gelernt?',
    'Worauf bist du in diesem Jahr ein bisschen stolz?',
    'Was gibt dir Energie, wenn du müde bist?',
    'Welcher Rat hat dir einmal wirklich geholfen?',
    'Was machst du, um abzuschalten?',
    'Welche Eigenschaft schätzt du an anderen am meisten?',
    'Was würdest du gern besser können?',
    'Welche Erinnerung bringt dich immer zum Schmunzeln?',
    'Was steht als Nächstes auf deiner persönlichen Wunschliste an Erlebnissen?',
    'Wofür bist du heute dankbar?',
  ]),
  ...liste('deep', [
    'Was bedeutet für dich ein gutes Leben?',
    'Welche Meinung hast du in den letzten Jahren geändert?',
    'Was glaubst du, unterschätzen die meisten Menschen?',
    'Was würdest du deinem jüngeren Ich sagen?',
    'Wann hast du dich zuletzt richtig frei gefühlt?',
    'Was macht für dich eine echte Freundschaft aus?',
    'Welche Frage beschäftigt dich zurzeit?',
    'Glaubst du eher an Zufall oder an Schicksal?',
    'Was möchtest du in zehn Jahren über heute sagen können?',
    'Was hat dich in letzter Zeit zum Nachdenken gebracht?',
  ]),
  ...liste('alltag', [
    'Was steht bei dir heute noch an?',
    'Was ist dein liebstes schnelles Gericht nach einem langen Tag?',
    'Welche Routine würdest du nie mehr hergeben?',
    'Wie sieht für dich ein perfekter Sonntag aus?',
    'Was ist die nervigste Hausarbeit überhaupt?',
    'Welche App benutzt du täglich, ohne darüber nachzudenken?',
    'Gehst du lieber früh schlafen oder spät?',
    'Was ist dein Trick gegen schlechte Laune?',
    'Planst du gern oder lässt du dich treiben?',
    'Welche kleine Gewohnheit hat dein Leben leichter gemacht?',
  ]),
  ...liste('interessen', [
    'Welches Buch oder welcher Film hat dich zuletzt überrascht?',
    'Welches Hobby würdest du gern einmal ausprobieren?',
    'Welche Serie könntest du immer wieder schauen?',
    'Welche Musik hörst du, wenn du dich konzentrieren willst?',
    'Welcher Ort, an dem du warst, hat dich am meisten beeindruckt?',
    'Welches Spiel hat dich zuletzt nicht mehr losgelassen?',
    'Welches Thema könntest du stundenlang erklären?',
    'Was kochst du, wenn du jemanden beeindrucken willst?',
    'Welcher Sport macht dir am meisten Spass, zum Zuschauen oder selbst?',
    'Worüber hast du zuletzt etwas gelesen, das dich fasziniert hat?',
  ]),
  ...liste('hypothetisch', [
    'Wenn du eine Fähigkeit sofort beherrschen könntest, welche wäre es?',
    'Du hast ein Jahr frei und genug Geld: Was machst du?',
    'In welche Epoche würdest du für einen Tag reisen?',
    'Wenn du ein Gesetz einführen dürftest, welches wäre es?',
    'Welche Erfindung sollte es endlich geben?',
    'Du kannst mit einem Tier reden: Mit welchem und was fragst du?',
    'Wenn du nur noch ein Essen für immer hättest, welches wäre es?',
    'Du darfst eine Sache an der Welt ändern: Was wäre das?',
    'Stadt, Land oder ganz einsam auf einer Insel?',
    'Welche Superkraft wäre im Alltag am praktischsten?',
  ]),
]

/** Wie viele Vorschläge gleichzeitig gezeigt werden. */
export const VORSCHLAEGE_ANZAHL = 3

/**
 * Zieht `anzahl` verschiedene Vorschläge. Was gerade zu sehen war
 * (`ausser`), kommt nicht gleich wieder, solange genug anderes da ist.
 */
export function zieheVorschlaege(
  anzahl = VORSCHLAEGE_ANZAHL,
  ausser: string[] = [],
  zufall: () => number = Math.random,
): Starter[] {
  const frisch = GESPRAECHSSTARTER.filter((s) => !ausser.includes(s.text))
  const pool = frisch.length >= anzahl ? [...frisch] : [...GESPRAECHSSTARTER]
  const gezogen: Starter[] = []
  while (gezogen.length < anzahl && pool.length > 0) {
    const i = Math.floor(zufall() * pool.length) % pool.length
    gezogen.push(pool.splice(i, 1)[0])
  }
  return gezogen
}
