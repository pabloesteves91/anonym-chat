import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Field, Note, PageTitle, Panel, inputClass } from '../components/ui'
import { EigeneStatistik } from '../components/EigeneStatistik'
import { buttonClass } from '../components/buttonClass'
import { Kontokennung } from '../components/Kontokennung'
import { aktiverPlan, grenzenFuer, planById, verbleibend } from '../services/plans'
import { ROLLE_LABEL } from '../services/roles'
import { NAME_MAX, validateDisplayName } from '../services/wordFilter'
import { AGE_GROUPS, GESCHLECHTER, LANGUAGES } from '../services/types'
import type { AgeGroup, Language, Profile as ProfileData } from '../services/types'
import { useSession } from '../store/useSession'


export function Profile() {
  const navigate = useNavigate()
  const user = useSession((s) => s.user)
  const busy = useSession((s) => s.busy)
  const saveProfile = useSession((s) => s.saveProfile)
  const newPseudonym = useSession((s) => s.newPseudonym)
  const renamePseudonym = useSession((s) => s.renamePseudonym)
  const error = useSession((s) => s.error)
  const resetIdentity = useSession((s) => s.resetIdentity)
  const selfBlocked = useSession((s) => s.selfBlocked)
  const refreshBlocks = useSession((s) => s.refreshBlocks)
  const unblockAll = useSession((s) => s.unblockAll)

  useEffect(() => {
    void refreshBlocks()
  }, [refreshBlocks])

  // Kein Effekt zum Spiegeln: der Entwurf überlagert das Profil nur, solange
  // er existiert. Nach dem Speichern sind beide wieder deckungsgleich.
  const [draft, setDraft] = useState<ProfileData | null>(null)
  const [saved, setSaved] = useState(false)
  const [nameEntwurf, setNameEntwurf] = useState<string | null>(null)
  const [nameMeldung, setNameMeldung] = useState<string | null>(null)

  if (!user) return null

  const darfUmbenennen = grenzenFuer(user).eigenerName
  const imBetrieb = user.rolle !== 'nutzer'
  const meinPlan = planById(aktiverPlan(user.membership))
  const uebrig = verbleibend(user)
  const entwurf = draft ?? user.profile
  // Interessen gehören nicht mehr ins Profil – gesucht wird mit ihnen in der
  // Suche (nur dort, mit Plus). Verglichen wird deshalb nur, was hier steht.
  const dirty = entwurf.language !== user.profile.language || entwurf.ageGroup !== user.profile.ageGroup

  const update = (patch: Partial<ProfileData>) => {
    setSaved(false)
    setDraft({ ...entwurf, ...patch })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="prose-column">
        <PageTitle kicker="Dein Konto">Profil</PageTitle>
        <p className="text-muted">
          Kein Klarname, kein Foto, keine Biografie. Andere sehen von dir nur den Anzeigenamen. Die übrigen Angaben
          siehst nur du, und du kannst sie jederzeit ändern.
        </p>
      </div>

      <Panel className="flex flex-col gap-4 p-5">
        <div>
          <p className="label-caps">Anzeigename</p>
          <p className="mt-1 text-sm text-muted">
            Diesen Namen sieht dein Gegenüber im Chat. Nimm nicht deinen echten Namen und schreib keine Kontaktdaten
            hinein. Der Name steht über jedem Gespräch.
          </p>
        </div>

        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={async (event) => {
            event.preventDefault()
            const wert = nameEntwurf ?? user.pseudonym
            const ok = await renamePseudonym(wert)
            setNameMeldung(ok ? 'Name geändert.' : null)
            if (ok) setNameEntwurf(null)
          }}
        >
          {/* Auf dem Handy: Feld über die ganze Breite, Knöpfe darunter. */}
          <div className="w-full sm:min-w-0 sm:flex-1">
            <label htmlFor="anzeigename" className="sr-only">
              Anzeigename
            </label>
            <input
              id="anzeigename"
              className={`${inputClass} font-mono`}
              maxLength={NAME_MAX}
              disabled={!darfUmbenennen}
              value={nameEntwurf ?? user.pseudonym}
              onChange={(event) => {
                setNameEntwurf(event.target.value)
                setNameMeldung(null)
              }}
            />
          </div>
          <div className="flex gap-3">
            <Button
              type="submit"
              variant="primary"
              className="flex-1 sm:flex-none"
              disabled={busy || !darfUmbenennen || nameEntwurf === null || nameEntwurf === user.pseudonym}
            >
              Speichern
            </Button>
            <Button
              type="button"
              className="flex-1 sm:flex-none"
              disabled={busy}
              onClick={async () => {
                setNameEntwurf(null)
                setNameMeldung(null)
                await newPseudonym()
              }}
            >
              Würfeln
            </Button>
          </div>
        </form>

        {user.geschlecht ? (
          <p className="text-sm text-muted">
            Dein Name wird in der {GESCHLECHTER.find((g) => g.value === user.geschlecht)?.label.toLowerCase()}en Form
            gebildet. Ändern kannst du das nur über den{' '}
            <Link to="/support" className="underline underline-offset-2 hover:text-ink">
              Support
            </Link>
            .
          </p>
        ) : null}

        {darfUmbenennen ? null : (
          <p className="text-sm text-muted">
            Gratis bekommst du einen zufälligen Namen. Das erschwert es, dich über verschiedene Gespräche hinweg
            wiederzuerkennen.{' '}
            <Link to="/preise" className="underline underline-offset-2 hover:text-ink">
              Mit Plus frei wählbar
            </Link>
          </p>
        )}

        {nameEntwurf !== null && !validateDisplayName(nameEntwurf).ok ? (
          <Note tone="warn">{validateDisplayName(nameEntwurf).error}</Note>
        ) : null}
        {error ? <Note tone="warn">{error}</Note> : null}
        <p aria-live="polite" className="text-sm text-muted">
          {nameMeldung ?? ''}
        </p>
      </Panel>

      <Panel className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="font-display text-xl font-semibold">Tarif</h2>
          <span className="label-caps">{imBetrieb ? ROLLE_LABEL[user.rolle] : meinPlan.name}</span>
        </div>
        <p className="text-sm text-muted">
          {imBetrieb
            ? 'Konten des Betreibers haben keine Tarifgrenzen: unbegrenzt chatten, alle Filter und ein eigener Anzeigename. Ein Tarif ist für dieses Konto nicht nötig.'
            : uebrig === null
              ? 'Unbegrenzt chatten, Filter nach Interessen und Vorrang in der Warteschlange.'
              : `Heute hast du noch ${uebrig} ${uebrig === 1 ? 'Chat' : 'Chats'}. Um Mitternacht beginnt das Limit von vorn.`}
          {!imBetrieb && user.membership.bis
            ? ` Läuft bis ${new Date(user.membership.bis).toLocaleDateString('de-CH', { dateStyle: 'long' })}.`
            : ''}
        </p>
        {imBetrieb ? null : (
          <div>
            <Link to="/preise" className={buttonClass(uebrig === null ? 'secondary' : 'primary', 'sm')}>
              {uebrig === null ? 'Tarife ansehen' : 'Limit aufheben'}
            </Link>
          </div>
        )}
      </Panel>

      <Kontokennung
        id={user.id}
        hinweis="Sie ist an deine Verifizierung gebunden und im Chat nie sichtbar. Deshalb lässt sich eine Sperre nicht mit einem neuen Konto umgehen."
      />

      {user.verified ? <EigeneStatistik /> : null}

      <Panel className="p-5">
        <form
          className="flex flex-col gap-6"
          onSubmit={async (event) => {
            event.preventDefault()
            // Früher gespeicherte Profil-Interessen gehen beim Speichern mit weg.
            await saveProfile({ ...entwurf, interests: [] })
            setSaved(true)
          }}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Sprache" htmlFor="sprache" hint="Wird für deine Suche voreingestellt.">
              <select
                id="sprache"
                className={inputClass}
                value={entwurf.language}
                onChange={(event) => update({ language: event.target.value as Language })}
              >
                {LANGUAGES.map((language) => (
                  <option key={language.value} value={language.value}>
                    {language.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Altersgruppe" htmlFor="alter" hint="Grobe Spanne statt Geburtsdatum.">
              <select
                id="alter"
                className={inputClass}
                value={entwurf.ageGroup}
                onChange={(event) => update({ ageGroup: event.target.value as AgeGroup })}
              >
                {AGE_GROUPS.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={busy || !dirty}>
              Speichern
            </Button>
            <Button type="button" variant="primary" onClick={() => navigate('/chat')}>
              Chat starten
            </Button>
            <span aria-live="polite" className="text-sm text-muted">
              {saved && !dirty ? 'Gespeichert.' : dirty ? 'Ungespeicherte Änderungen.' : ''}
            </span>
          </div>
        </form>
      </Panel>

      <Panel className="flex flex-col gap-3 p-5">
        <h2 className="font-display text-xl font-semibold">Blockierte Konten</h2>
        <p className="text-sm text-muted">
          {selfBlocked.length === 0
            ? 'Du hast niemanden blockiert. Im Chat geht das über „Nicht mehr verbinden". Die Moderation erfährt davon nichts.'
            : `${selfBlocked.length} ${selfBlocked.length === 1 ? 'Konto wird' : 'Konten werden'} dir nicht mehr zugeteilt. Sperren durch die Moderation haben damit nichts zu tun und lassen sich hier nicht aufheben.`}
        </p>
        {selfBlocked.length > 0 ? (
          <>
            <ul className="flex flex-wrap gap-2">
              {selfBlocked.map((id) => (
                <li key={id} className="rounded-sm border border-line px-2 py-1 font-mono text-xs text-muted">
                  {id}
                </li>
              ))}
            </ul>
            <div>
              <Button disabled={busy} onClick={() => void unblockAll()}>
                Alle Blockierungen aufheben
              </Button>
            </div>
          </>
        ) : null}
      </Panel>

      <Panel className="flex flex-col gap-3 p-5">
        <h2 className="font-display text-xl font-semibold">Profil zurücksetzen</h2>
        <Note tone="warn">
          Das setzt Anzeigename, Profil und Verifizierung zurück. Danach musst du deinen Ausweis neu einreichen. Dein
          Konto bleibt bestehen, mit allem, was daran hängt. Eine Sperre wirst du so nicht los. Ein bezahlter Tarif
          bleibt erhalten.
        </Note>
        <div>
          <Button
            variant="danger"
            onClick={async () => {
              await resetIdentity()
              navigate('/')
            }}
          >
            Zurücksetzen
          </Button>
        </div>
      </Panel>
    </div>
  )
}
