import type { Language, Message, Partner } from './types'

/**
 * Simulierte Gesprächspartner und ihr Antwortskript.
 *
 * Alles hier ist Attrappe: ein fester Pool erfundener Profile plus ein paar
 * Regeln, die aus dem bisherigen Verlauf eine plausible Antwort wählen. In
 * Phase 2 fällt diese Datei ersatzlos weg – dann kommen Nachrichten über
 * WebSocket von echten Nutzern.
 */

export const PARTNER_POOL: Partner[] = [
  { id: 'usr_k29fa1', pseudonym: 'Stiller Kranich 2048', language: 'de', interests: ['Bücher', 'Wandern', 'Kochen'] },
  { id: 'usr_m84bd0', pseudonym: 'Grauer Luchs 7731', language: 'de', interests: ['Technik', 'Games', 'Musik'] },
  { id: 'usr_p10cc5', pseudonym: 'Heller Dachs 3902', language: 'de', interests: ['Filme', 'Kunst', 'Reisen'] },
  { id: 'usr_r55ee2', pseudonym: 'Feiner Uhu 6184', language: 'de', interests: ['Politik', 'Bücher', 'Sport'] },
  { id: 'usr_t71ab9', pseudonym: 'Kühler Biber 4416', language: 'fr', interests: ['Kochen', 'Musik', 'Tiere'] },
  { id: 'usr_v33dd7', pseudonym: 'Wacher Marder 8820', language: 'en', interests: ['Games', 'Technik', 'Filme'] },
  { id: 'usr_w62ff4', pseudonym: 'Leiser Iltis 1157', language: 'it', interests: ['Reisen', 'Kunst', 'Kochen'] },
  { id: 'usr_x18gg3', pseudonym: 'Milder Habicht 5503', language: 'de', interests: ['Sport', 'Tiere', 'Wandern'] },
  { id: 'usr_y47hh8', pseudonym: 'Später Fuchs 9074', language: 'de', interests: ['Musik', 'Filme', 'Politik'] },
  { id: 'usr_z90ii6', pseudonym: 'Klarer Waldkauz 2265', language: 'fr', interests: ['Bücher', 'Technik', 'Reisen'] },
]

const OPENER = [
  'Hallo. Wie läuft dein Tag bisher?',
  'Hi – erster Chat heute für mich. Woher schreibst du gerade?',
  'Guten Abend. Worüber hättest du Lust zu reden?',
  'Hallo zusammen … also, hallo dir. Was machst du gerade?',
]

const OPENER_MIT_INTERESSE = (interesse: string) => [
  `Hallo. Bei dir steht ${interesse} – das trifft sich gut, bei mir auch.`,
  `Hi. ${interesse} steht bei uns beiden im Profil. Erzähl mal, wie kamst du dazu?`,
  `Guten Tag. Wir haben ${interesse} gemeinsam – womit fangen wir an?`,
]

const NACHFRAGEN = [
  'Und wie ist das bei dir?',
  'Erzähl mehr davon.',
  'Was hat dich daran interessiert?',
  'Wie lange machst du das schon?',
  'Hast du dafür eine Empfehlung?',
]

const REAKTIONEN = [
  'Das kann ich gut nachvollziehen.',
  'Interessant – daran hatte ich noch nicht gedacht.',
  'Ehrlich gesagt sehe ich das etwas anders, aber der Punkt stimmt.',
  'Ja, ähnlich geht es mir auch.',
  'Guter Punkt. Ich überlege gerade, ob ich dem zustimme.',
  'Bei mir ist das eher umgekehrt.',
]

const ANTWORTEN_AUF_FRAGE = [
  'Puh, gute Frage. Spontan würde ich sagen: kommt auf den Tag an.',
  'Das weiss ich selber nicht so genau, ehrlich gesagt.',
  'Ja, definitiv. Und bei dir?',
  'Eher selten, aber wenn, dann richtig.',
  'Da muss ich kurz überlegen … vermutlich schon.',
]

const THEMEN: Record<string, string[]> = {
  Bücher: ['Ich lese gerade zwei Bücher parallel, was nie gut endet.', 'Sachbuch oder Roman – wo landest du meistens?'],
  Musik: ['Zuletzt höre ich viel Ruhiges, nichts mit Text.', 'Konzert oder Kopfhörer, was ist dir lieber?'],
  Wandern: ['Am Wochenende war ich auf einer kleinen Tour, vier Stunden etwa.', 'Flach und lang oder steil und kurz?'],
  Kochen: ['Ich koche unter der Woche fast immer dasselbe, am Wochenende dafür aufwendig.', 'Was ist dein Standardgericht?'],
  Filme: ['Ich habe eine Liste mit 60 Filmen, die ich nie abarbeite.', 'Kino oder zuhause?'],
  Technik: ['Beruflich zu viel davon, privat trotzdem noch mehr.', 'Bastelst du selber an Sachen herum?'],
  Sport: ['Dreimal die Woche, wenn ich ehrlich bin eher zweimal.', 'Allein oder im Verein?'],
  Reisen: ['Am liebsten mit dem Zug, auch wenn es länger dauert.', 'Gleiche Orte wieder oder immer neue?'],
  Kunst: ['Ich gehe gern in Ausstellungen, verstehe aber selten die Texte daneben.', 'Machst du selber etwas?'],
  Games: ['Gerade wieder ein altes Spiel angefangen statt einem neuen.', 'Allein oder zusammen mit anderen?'],
  Politik: ['Ich lese mehr, als mir guttut.', 'Lokal oder international – was verfolgst du eher?'],
  Tiere: ['Ich hatte früher eine Katze, jetzt nur noch die vom Nachbarn.', 'Hast du Tiere?'],
}

/** Grenzwertige Zeilen – damit Wortfilter und Meldeweg testbar sind. */
const GRENZWERTIG = [
  'Schreib mir doch auf Telegram weiter, hier ist es mir zu umständlich.',
  'Schick mir mal ein Bild von dir, nur so zum Schauen.',
  'Hast du Insta? Dann können wir dort weitermachen.',
]

const ABSCHIED = ['Ich muss dann langsam los. War nett.', 'Ok, ich klinke mich aus. Alles Gute dir.']

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

export function openerFor(sharedInterests: string[]): string {
  if (sharedInterests.length > 0) return pick(OPENER_MIT_INTERESSE(pick(sharedInterests)))
  return pick(OPENER)
}

/**
 * Wählt die nächste Partnerantwort aus dem Verlauf.
 * `turn` = wievielte Partnerantwort in diesem Chat.
 */
export function replyFor(partner: Partner, history: Message[], turn: number): string {
  const last = [...history].reverse().find((m) => m.author === 'me')
  const text = last?.text ?? ''

  if (turn >= 12 && Math.random() < 0.3) return pick(ABSCHIED)
  if (turn >= 3 && Math.random() < 0.12) return pick(GRENZWERTIG)

  if (text.includes('?')) {
    return Math.random() < 0.5 ? pick(ANTWORTEN_AUF_FRAGE) : `${pick(ANTWORTEN_AUF_FRAGE)} ${pick(NACHFRAGEN)}`
  }

  const themen = partner.interests.flatMap((i) => THEMEN[i] ?? [])
  if (turn % 3 === 1 && themen.length > 0) return pick(themen)

  return Math.random() < 0.55 ? `${pick(REAKTIONEN)} ${pick(NACHFRAGEN)}` : pick(REAKTIONEN)
}

/** Tippdauer grob an der Antwortlänge orientiert. */
export function typingDurationFor(text: string): number {
  return Math.min(4200, 700 + text.length * 32)
}

export function languageLabelShort(language: Language): string {
  return { de: 'DE', fr: 'FR', it: 'IT', en: 'EN' }[language]
}
