import { useEffect } from 'react'
import { PageTitle } from '../components/ui'
import { artLabel, datumLang, neuesteVersion, type Neuigkeit } from '../services/neuigkeiten'
import { useNeuigkeiten } from '../store/useNeuigkeiten'

const ART_KLASSE: Record<Neuigkeit['art'], string> = {
  neu: 'border-accent/45 bg-accent-soft text-accent-strong',
  verbessert: 'border-line-strong bg-raised text-ink',
  behoben: 'border-signal/35 bg-signal-soft text-ink',
}

export function Eintrag({ eintrag, neueste }: { eintrag: Neuigkeit; neueste: boolean }) {
  return (
    <article className="flex flex-col gap-2 border-l-2 border-line pl-4 sm:pl-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <time dateTime={eintrag.datum} className="text-muted">
          {datumLang(eintrag.datum)}
        </time>
        <span className={`rounded-sm border px-2 py-0.5 text-xs font-medium ${ART_KLASSE[eintrag.art]}`}>
          {artLabel(eintrag.art)}
        </span>
        {eintrag.version ? (
          <span className="font-mono text-xs text-muted">
            Version {eintrag.version}
            {neueste ? <strong className="ml-1 font-sans font-semibold text-accent-strong">(neueste Version)</strong> : null}
          </span>
        ) : null}
      </div>
      <h2 className="font-display text-xl font-semibold">{eintrag.titel}</h2>
      <p className="prose-column whitespace-pre-line text-muted">{eintrag.text}</p>
    </article>
  )
}

/**
 * Neuigkeiten – was sich an NØNE geändert hat, neueste zuerst.
 *
 * Wer die Seite öffnet, hat alles gesehen: Der Punkt am Menüpunkt geht aus.
 */
export function Neuigkeiten() {
  const liste = useNeuigkeiten((s) => s.liste)
  const bereit = useNeuigkeiten((s) => s.bereit)
  const allesGesehen = useNeuigkeiten((s) => s.allesGesehen)
  const neueste = neuesteVersion(liste)

  // Auch, was während des Lesens neu dazukommt, gilt als gesehen.
  useEffect(() => {
    if (bereit) allesGesehen()
  }, [bereit, liste, allesGesehen])

  return (
    <div className="flex flex-col gap-8">
      <div className="prose-column">
        <PageTitle kicker="Neuigkeiten">Was sich geändert hat</PageTitle>
        <p className="text-muted">
          Neue Funktionen, Verbesserungen und Behobenes – mit Datum und der Version, in der es dazugekommen ist. Welche
          Version du gerade hast, steht ganz unten auf jeder Seite.
        </p>
      </div>

      {!bereit ? (
        <p className="label-caps" role="status">
          Wird geladen …
        </p>
      ) : liste.length === 0 ? (
        <p className="text-muted">Noch keine Neuigkeiten.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {liste.map((eintrag) => (
            <Eintrag key={eintrag.id} eintrag={eintrag} neueste={Boolean(neueste) && eintrag.version === neueste} />
          ))}
        </div>
      )}
    </div>
  )
}
