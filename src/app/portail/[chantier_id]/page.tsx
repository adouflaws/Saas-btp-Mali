import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import PhotoModal from './PhotoModal'
import StatusBadge, { statutBarClass } from '@/components/StatusBadge'

/* ─── Types ─────────────────────────────────────────── */

type Chantier = {
  id: string; nom: string; client_nom: string; ville: string | null
  statut: string | null; avancement: number | null
  date_debut: string | null; date_fin_prevue: string | null
  portail_actif: boolean | null; entreprise_id: string | null
}
type Entreprise = { nom: string | null; telephone: string | null }
type Jalon  = { id: string; nom: string; date_prevue: string; date_reelle: string | null; atteint: boolean | null }
type Photo  = { id: string; url: string; nom: string | null; legende: string | null; prise_le: string }

/* ─── Helpers ───────────────────────────────────────── */

function daysRemaining(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 1)  return "il y a moins d'une heure"
  if (d === 0) return `il y a ${h}h`
  if (d === 1) return "hier"
  if (d < 7)  return `il y a ${d} jours`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

/* ─── Page ───────────────────────────────────────────── */

export default async function PortailPage({ params }: { params: Promise<{ chantier_id: string }> }) {
  const { chantier_id } = await params
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const { data: chantier, error: chantierError } = await supabase
    .from('chantiers')
    .select('id, nom, client_nom, ville, statut, avancement, date_debut, date_fin_prevue, portail_actif, entreprise_id')
    .eq('id', chantier_id)
    .single()

  /* ── Portail introuvable ── */
  if (!chantier) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <div className="w-full max-w-xs text-center">
          <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center mx-auto mb-5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-gray-300">
              <path d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-[#1C1C1C] text-lg font-bold mb-2">Portail introuvable</h1>
          <p className="text-[#6B7280] text-sm">Ce lien n&apos;existe pas ou a été supprimé.</p>
          {chantierError && <p className="text-red-400 text-xs font-mono bg-red-50 px-3 py-2 rounded-lg mt-4 break-all">{chantierError.message}</p>}
        </div>
      </div>
    )
  }

  /* ── Portail désactivé ── */
  if ((chantier as Chantier).portail_actif === false) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <div className="w-full max-w-xs text-center">
          <div className="w-14 h-14 bg-orange-50 rounded-2xl border border-orange-100 flex items-center justify-center mx-auto mb-5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-orange-400">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-[#1C1C1C] text-lg font-bold mb-2">Portail désactivé</h1>
          <p className="text-[#6B7280] text-sm">Ce portail n&apos;est plus disponible. Contactez votre chef de chantier.</p>
          <p className="text-gray-300 text-xs mt-8">Propulsé par <span className="text-orange-400 font-semibold">BTP Mali</span></p>
        </div>
      </div>
    )
  }

  const c = chantier as Chantier

  const [{ data: jalonsRaw }, { data: photosRaw }, entrepriseResult] = await Promise.all([
    supabase.from('jalons').select('id, nom, date_prevue, date_reelle, atteint').eq('chantier_id', chantier_id).order('date_prevue'),
    supabase.from('photos_chantier').select('*').eq('chantier_id', chantier_id).order('prise_le', { ascending: false }),
    c.entreprise_id
      ? supabase.from('entreprises').select('nom, telephone').eq('id', c.entreprise_id).single()
      : Promise.resolve({ data: null, error: null }),
  ])

  const jalons      = (jalonsRaw ?? []) as Jalon[]
  const photos      = (photosRaw ?? []) as Photo[]
  const entreprise  = entrepriseResult.data as Entreprise | null

  const avancement      = c.avancement ?? 0
  const joursRestants   = daysRemaining(c.date_fin_prevue)
  const jalonsAtteints  = jalons.filter(j => j.atteint).length
  const jalonsRestants  = jalons.filter(j => !j.atteint).length
  const firstNonDoneIdx = jalons.findIndex(j => !j.atteint)
  const whatsappTel     = entreprise?.telephone?.replace(/\D/g, '')
  const whatsappUrl     = whatsappTel
    ? `https://wa.me/${whatsappTel}?text=${encodeURIComponent(`Bonjour, j'ai une question concernant mon chantier "${c.nom}".`)}`
    : null
  const lastPhoto       = photos[0] ?? null

  const stats = [
    { label: 'Jalons terminés', value: jalonsAtteints,  sub: jalons.length > 0 ? `sur ${jalons.length}` : null },
    { label: 'Jalons restants', value: jalonsRestants,   sub: null },
    { label: 'Photos',          value: photos.length,    sub: null },
    {
      label: joursRestants === null ? 'Calendrier' : joursRestants >= 0 ? 'Jours restants' : 'Jours dépassés',
      value: joursRestants === null ? '—' : Math.abs(joursRestants),
      sub: null,
    },
  ]

  return (
    <div className="min-h-screen bg-[#F8F9FA]">

      {/* ══════════════════════════════
          HEADER BAR
      ══════════════════════════════ */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">

          {/* Logo + Entreprise */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                <path d="M3 21h18M5 21V11m14 0v10M3 11l9-7 9 7M10 21v-5h4v5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[#1C1C1C] font-bold text-[14px] leading-none">BTP Mali</p>
              {entreprise?.nom && (
                <p className="text-[#6B7280] text-[11px] mt-0.5 truncate">{entreprise.nom}</p>
              )}
            </div>
          </div>

          {/* Mis à jour */}
          {lastPhoto && (
            <p className="text-[11px] text-gray-400 shrink-0 hidden sm:block">
              Mis à jour {relativeTime(lastPhoto.prise_le)}
            </p>
          )}
        </div>
      </header>

      {/* ══════════════════════════════
          HERO CHANTIER
      ══════════════════════════════ */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h1 className="text-[#1C1C1C] text-2xl font-bold leading-tight flex-1 min-w-0">
              {c.nom}
            </h1>
            <div className="shrink-0 mt-0.5">
              <StatusBadge type="chantier" statut={c.statut} theme="light" />
            </div>
          </div>
          {(c.client_nom || c.ville) && (
            <p className="text-[#6B7280] text-[13px]">
              {c.client_nom}{c.client_nom && c.ville ? ' · ' : ''}{c.ville}
            </p>
          )}
          {lastPhoto && (
            <p className="text-[11px] text-gray-400 mt-1 sm:hidden">
              Mis à jour {relativeTime(lastPhoto.prise_le)}
            </p>
          )}
        </div>
      </div>

      {/* ══════════════════════════════
          CONTENU
      ══════════════════════════════ */}
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ── PROGRESSION ── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-baseline gap-3 mb-3">
            <span className="text-[42px] font-black text-orange-500 leading-none tracking-tight">
              {avancement}%
            </span>
            <span className="text-[#6B7280] text-sm font-medium">d&apos;avancement</span>
          </div>

          {/* Barre fine */}
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
            <div
              className={`h-full rounded-full transition-all ${statutBarClass('chantier', c.statut)}`}
              style={{ width: `${avancement}%` }}
            />
          </div>

          {/* Dates */}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[12px]">
            {c.date_debut && (
              <span className="text-[#6B7280]">
                Debut <span className="font-semibold text-[#1C1C1C]">{fmtDate(c.date_debut)}</span>
              </span>
            )}
            {c.date_fin_prevue && (
              <span className="text-[#6B7280]">
                Fin prevue <span className="font-semibold text-[#1C1C1C]">{fmtDate(c.date_fin_prevue)}</span>
              </span>
            )}
            {joursRestants !== null && (
              <span className={`font-semibold ${joursRestants < 0 ? 'text-red-500' : 'text-[#6B7280]'}`}>
                {joursRestants < 0
                  ? `${Math.abs(joursRestants)} jours de retard`
                  : `${joursRestants} jours restants`}
              </span>
            )}
          </div>
        </section>

        {/* ── STATS 2x2 ── */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-[28px] font-black text-[#1C1C1C] leading-none mb-1.5">{s.value}</p>
              <p className="text-[#6B7280] text-[12px] font-medium leading-tight">{s.label}</p>
              {s.sub && <p className="text-gray-300 text-[11px] mt-0.5">{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* ── ETAPES / JALONS ── */}
        {jalons.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-[#1C1C1C] text-[14px] font-bold mb-5">Étapes du chantier</h2>

            <div className="relative">
              {/* Ligne verticale */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-100 pointer-events-none" />

              <div className="space-y-5">
                {jalons.map((j, i) => {
                  const done    = !!j.atteint
                  const enCours = !done && i === firstNonDoneIdx

                  const dateLabel = done && j.date_reelle
                    ? new Date(j.date_reelle).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                    : `Prevu ${new Date(j.date_prevue).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`

                  return (
                    <div key={j.id} className="flex items-start gap-4">
                      {/* Pastille */}
                      <div className="shrink-0 mt-0.5 z-10">
                        {done && <div className="w-[15px] h-[15px] rounded-full bg-orange-500" />}
                        {enCours && (
                          <div className="w-[15px] h-[15px] rounded-full border-2 border-orange-500 bg-white flex items-center justify-center">
                            <div className="w-[7px] h-[7px] rounded-full bg-orange-500" />
                          </div>
                        )}
                        {!done && !enCours && (
                          <div className="w-[15px] h-[15px] rounded-full border-2 border-gray-200 bg-white" />
                        )}
                      </div>

                      {/* Texte */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-[13px] font-semibold ${done ? 'text-[#1C1C1C]' : enCours ? 'text-orange-600' : 'text-gray-400'}`}>
                            {j.nom}
                          </p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            done    ? 'bg-orange-50 text-orange-500' :
                            enCours ? 'bg-orange-50 text-orange-400' :
                                      'bg-gray-50 text-gray-400'
                          }`}>
                            {done ? 'Termine' : enCours ? 'En cours' : 'A venir'}
                          </span>
                        </div>
                        <p className="text-[#6B7280] text-[11px] mt-0.5">{dateLabel}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── PHOTOS ── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-[#1C1C1C] text-[14px] font-bold mb-4">
            Photos du chantier
            {photos.length > 0 && (
              <span className="ml-2 text-[#6B7280] font-normal text-[12px]">
                {photos.length} photo{photos.length > 1 ? 's' : ''}
              </span>
            )}
          </h2>
          <PhotoModal photos={photos} />
        </section>

        {/* ── CONTACT ── */}
        {whatsappUrl && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-[#1C1C1C] text-[14px] font-bold mb-1">
              {c.client_nom
                ? `Bonjour ${c.client_nom}, une question sur votre chantier ?`
                : 'Une question sur votre chantier ?'}
            </p>
            <p className="text-[#6B7280] text-[12px] mb-4">Notre equipe est disponible pour vous repondre.</p>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 w-full py-3 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold text-[14px] rounded-xl transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Contacter sur WhatsApp
            </a>
          </section>
        )}

        {/* ── FOOTER ── */}
        <footer className="py-4 text-center">
          <p className="text-gray-300 text-[11px]">
            Suivi de chantier propulse par{' '}
            <a
              href="https://saas-btp-mali.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 font-semibold hover:text-orange-500 transition-colors"
            >
              BTP Mali
            </a>
          </p>
        </footer>

      </div>
    </div>
  )
}
