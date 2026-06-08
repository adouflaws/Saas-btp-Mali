import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import PhotoModal from './PhotoModal'

/* ─── Types ─────────────────────────────────────────── */

type Chantier = {
  id: string; nom: string; client_nom: string; ville: string | null
  statut: string | null; avancement: number | null
  date_debut: string | null; date_fin_prevue: string | null
  portail_actif: boolean | null; entreprise_id: string | null
}
type Entreprise = { nom: string | null; telephone: string | null }
type Tache = { id: string; nom: string; statut: string | null; avancement: number | null; date_fin_prevue: string | null }
type Jalon = { id: string; nom: string; date_prevue: string; date_reelle: string | null; atteint: boolean | null }
type Photo = { id: string; url: string; nom: string | null; legende: string | null; prise_le: string }

/* ─── Helpers ───────────────────────────────────────── */

function relativeTime(dateStr: string): string {
  const now  = new Date()
  const date = new Date(dateStr)
  const diffMs    = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays  = Math.floor(diffHours / 24)
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (diffHours < 1)  return 'il y a moins d\'une heure'
  if (diffDays === 0) return `aujourd'hui à ${time}`
  if (diffDays === 1) return `hier à ${time}`
  if (diffDays < 7)   return `il y a ${diffDays} jours`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function daysRemaining(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

const STATUTS = {
  preparation: { label: '🔵 En préparation', bar: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700 border border-blue-200' },
  en_cours:    { label: '🟢 En cours',       bar: 'bg-orange-500',  badge: 'bg-green-50 text-green-700 border border-green-200' },
  en_pause:    { label: '🟡 En pause',       bar: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
  termine:     { label: '✅ Terminé',         bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  annule:      { label: '🔴 Annulé',         bar: 'bg-red-400',     badge: 'bg-red-50 text-red-700 border border-red-200' },
}
function getStatut(v: string | null) {
  return STATUTS[v as keyof typeof STATUTS] ?? STATUTS.en_cours
}

/* ─── Page (Server Component) ───────────────────────── */

export default async function PortailPage({ params }: { params: Promise<{ chantier_id: string }> }) {
  const { chantier_id } = await params
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  /* Chantier */
  const { data: chantier, error: chantierError } = await supabase
    .from('chantiers')
    .select('id, nom, client_nom, ville, statut, avancement, date_debut, date_fin_prevue, portail_actif, entreprise_id')
    .eq('id', chantier_id)
    .single()

  /* Portail introuvable */
  if (!chantier) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <div className="text-center max-w-xs">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 border border-gray-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-gray-400">
              <path d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-gray-800 text-xl font-bold mb-2">Portail introuvable</h1>
          <p className="text-gray-500 text-sm mb-3">Ce lien n'existe pas ou a été supprimé.</p>
          {chantierError && <p className="text-red-400 text-xs font-mono bg-red-50 px-3 py-2 rounded-lg">{chantierError.message}</p>}
        </div>
      </div>
    )
  }

  /* Portail désactivé */
  if ((chantier as Chantier).portail_actif === false) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <div className="text-center max-w-xs">
          <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-orange-500">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-gray-800 text-xl font-bold mb-2">Portail désactivé</h1>
          <p className="text-gray-500 text-sm">Ce portail n'est plus disponible. Contactez votre chef de chantier.</p>
          <p className="text-gray-300 text-xs mt-6">Propulsé par <span className="text-orange-400 font-semibold">BTP Mali</span></p>
        </div>
      </div>
    )
  }

  const c = chantier as Chantier

  /* Toutes les données en parallèle */
  const [
    { data: tachesRaw },
    { data: jalonsRaw },
    { data: photosRaw },
    entrepriseResult,
  ] = await Promise.all([
    supabase.from('taches').select('id, nom, statut, avancement, date_fin_prevue').eq('chantier_id', chantier_id).order('ordre'),
    supabase.from('jalons').select('id, nom, date_prevue, date_reelle, atteint').eq('chantier_id', chantier_id).order('date_prevue'),
    supabase.from('photos_chantier').select('*').eq('chantier_id', chantier_id).order('prise_le', { ascending: false }),
    c.entreprise_id
      ? supabase.from('entreprises').select('nom, telephone').eq('id', c.entreprise_id).single()
      : Promise.resolve({ data: null, error: null }),
  ])

  const taches     = (tachesRaw ?? []) as Tache[]
  const jalons     = (jalonsRaw ?? []) as Jalon[]
  const photos     = (photosRaw ?? []) as Photo[]
  const entreprise = entrepriseResult.data as Entreprise | null

  /* Calculs */
  const statut          = getStatut(c.statut)
  const avancement      = c.avancement ?? 0
  const tachesTotal     = taches.length
  const tachesTerminees = taches.filter(t => t.statut === 'termine').length
  const tachesEnCours   = taches.filter(t => t.statut === 'en_cours').length
  const jalonsAtteints  = jalons.filter(j => j.atteint).length
  const joursRestants   = daysRemaining(c.date_fin_prevue)
  const derniereMaj     = photos.length > 0 ? relativeTime(photos[0].prise_le) : null

  const whatsappTel = entreprise?.telephone?.replace(/\D/g, '')
  const whatsappUrl = whatsappTel
    ? `https://wa.me/${whatsappTel}?text=${encodeURIComponent(`Bonjour, j'ai une question concernant le chantier "${c.nom}".`)}`
    : null

  /* ── Rendu ── */
  return (
    <div className="min-h-screen bg-[#F8F9FA]">

      {/* ══════════════════════════════════════
          EN-TÊTE
      ══════════════════════════════════════ */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                <path d="M3 21h18M5 21V11m14 0v10M3 11l9-7 9 7M10 21v-5h4v5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-black text-[15px] text-gray-900">BTP <span className="text-orange-500">Mali</span></span>
          </div>
          {entreprise?.nom && (
            <span className="text-gray-500 text-[12px] font-medium truncate max-w-[160px]">{entreprise.nom}</span>
          )}
        </div>
      </header>

      {/* Bannière orange */}
      <div className="bg-orange-500 text-white">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-8">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-orange-200 text-[11px] font-semibold uppercase tracking-wider mb-1">Portail client</p>
              <h1 className="text-[24px] font-black leading-tight">{c.nom}</h1>
              <p className="text-orange-200 text-[13px] mt-1 font-medium">{c.client_nom}{c.ville && ` · 📍 ${c.ville}`}</p>
            </div>
            <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full shrink-0 mt-1 ${statut.badge}`}>
              {statut.label}
            </span>
          </div>
          {derniereMaj && (
            <div className="flex items-center gap-1.5 text-orange-200 text-[12px]">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0">
                <path fillRule="evenodd" d="M8 16A8 8 0 108 0a8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L9 7.586V4z" clipRule="evenodd"/>
              </svg>
              Mis à jour {derniereMaj}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-3 pb-8 space-y-4">

        {/* ══════════════════════════════════════
            SECTION 1 — PROGRESSION
        ══════════════════════════════════════ */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-gray-500 text-[11px] font-bold uppercase tracking-wider mb-4">Avancement du chantier</h2>
          <div className="text-center mb-4">
            <p className="text-[64px] font-black text-orange-500 leading-none">{avancement}<span className="text-[28px] text-orange-400">%</span></p>
          </div>
          <div className="h-4 bg-gray-100 rounded-full overflow-hidden mb-5 shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-700 ${statut.bar}`}
              style={{ width: `${avancement}%` }}
            />
          </div>
          <div className={`grid gap-3 text-center ${[c.date_debut, c.date_fin_prevue, joursRestants].filter(Boolean).length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {c.date_debut && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-gray-400 text-[10px] font-semibold uppercase mb-1">📅 Début</p>
                <p className="text-gray-800 text-[13px] font-bold">
                  {new Date(c.date_debut).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </p>
              </div>
            )}
            {c.date_fin_prevue && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-gray-400 text-[10px] font-semibold uppercase mb-1">🎯 Fin prévue</p>
                <p className="text-gray-800 text-[13px] font-bold">
                  {new Date(c.date_fin_prevue).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </p>
              </div>
            )}
            {joursRestants !== null && (
              <div className={`rounded-xl p-3 ${joursRestants < 0 ? 'bg-red-50' : joursRestants < 30 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                <p className="text-gray-400 text-[10px] font-semibold uppercase mb-1">⏱️ Reste</p>
                <p className={`text-[13px] font-bold ${joursRestants < 0 ? 'text-red-600' : joursRestants < 30 ? 'text-amber-700' : 'text-gray-800'}`}>
                  {joursRestants < 0 ? `${Math.abs(joursRestants)}j dépassés` : `${joursRestants} jours`}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════
            SECTION 2 — 4 CARTES RÉSUMÉ
        ══════════════════════════════════════ */}
        {tachesTotal > 0 && (
          <section>
            <h2 className="text-gray-500 text-[11px] font-bold uppercase tracking-wider mb-3">Vue d'ensemble</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total tâches',       value: tachesTotal,                icon: '📋', color: 'text-gray-800',    bg: 'bg-white' },
                { label: 'Terminées',          value: tachesTerminees,            icon: '✅', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'En cours',           value: tachesEnCours,              icon: '🔨', color: 'text-orange-600',  bg: 'bg-orange-50' },
                { label: 'Jalons atteints',    value: `${jalonsAtteints}/${jalons.length}`, icon: '🏁', color: 'text-blue-600', bg: 'bg-blue-50' },
              ].map(card => (
                <div key={card.label} className={`${card.bg} rounded-2xl shadow-sm border border-gray-100 p-4 text-center`}>
                  <p className="text-2xl mb-0.5">{card.icon}</p>
                  <p className={`text-[28px] font-black leading-none ${card.color}`}>{card.value}</p>
                  <p className="text-gray-500 text-[11px] font-medium mt-1">{card.label}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════
            SECTION 3 — ACTIVITÉ RÉCENTE
        ══════════════════════════════════════ */}
        {taches.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h2 className="text-gray-800 text-[15px] font-bold">Ce qui vient de se passer</h2>
              <span className="text-gray-400 text-[11px]">{taches.length} tâches</span>
            </div>
            <div className="divide-y divide-gray-50">
              {[...taches]
                .sort((a, b) => {
                  const order = ['en_cours', 'bloque', 'termine', 'a_faire']
                  return order.indexOf(a.statut ?? 'a_faire') - order.indexOf(b.statut ?? 'a_faire')
                })
                .slice(0, 5)
                .map(t => {
                  const av     = t.avancement ?? 0
                  const icon   = t.statut === 'termine' ? '✅' : t.statut === 'en_cours' ? '🔨' : t.statut === 'bloque' ? '🚫' : '⏳'
                  const barCol = t.statut === 'termine' ? 'bg-emerald-500' : t.statut === 'bloque' ? 'bg-red-400' : 'bg-orange-500'
                  const label  = t.statut === 'termine' ? 'terminé' : t.statut === 'en_cours' ? 'en cours' : t.statut === 'bloque' ? 'bloqué' : 'à faire'
                  return (
                    <div key={t.id} className="px-5 py-3.5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[16px] shrink-0">{icon}</span>
                        <p className="text-gray-800 text-[13px] font-semibold truncate flex-1">{t.nom}</p>
                        <span className="text-gray-500 text-[11px] font-bold shrink-0">{av}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden ml-7">
                        <div className={`h-full rounded-full ${barCol}`} style={{ width: `${av}%` }} />
                      </div>
                      <p className="text-gray-400 text-[10px] mt-1.5 ml-7">
                        {label}
                        {t.date_fin_prevue && t.statut !== 'termine' && ` · prévu le ${new Date(t.date_fin_prevue).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}
                      </p>
                    </div>
                  )
                })}
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════
            SECTION 4 — PHOTOS
        ══════════════════════════════════════ */}
        <section>
          <h2 className="text-gray-800 text-[15px] font-bold mb-3">
            📸 Suivi photographique
            {photos.length > 0 && (
              <span className="text-gray-400 text-[13px] font-normal ml-1">({photos.length} photo{photos.length > 1 ? 's' : ''})</span>
            )}
          </h2>
          <PhotoModal photos={photos} />
        </section>

        {/* ══════════════════════════════════════
            SECTION 5 — JALONS (timeline)
        ══════════════════════════════════════ */}
        {jalons.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="text-gray-800 text-[15px] font-bold">Étapes du projet</h2>
            </div>
            <div className="px-5 py-4">
              <div className="relative space-y-4">
                <div className="absolute left-[8px] top-2 bottom-2 w-0.5 bg-gray-100" />
                {jalons.map(j => {
                  const done   = !!j.atteint
                  const isPast = new Date(j.date_prevue) < new Date()
                  const dateLabel = done && j.date_reelle
                    ? `Terminé le ${new Date(j.date_reelle).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
                    : `Prévu pour ${new Date(j.date_prevue).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
                  return (
                    <div key={j.id} className="flex items-start gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 z-10 flex items-center justify-center ${done ? 'bg-emerald-500 border-emerald-500' : isPast ? 'bg-amber-400 border-amber-400' : 'bg-white border-gray-300'}`}>
                        {done && (
                          <svg viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" className="w-2.5 h-2.5">
                            <path d="M1.5 5l2.5 2.5L8.5 2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-[13px] font-semibold leading-tight ${done ? 'text-emerald-700' : 'text-gray-800'}`}>{j.nom}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${done ? 'bg-emerald-100 text-emerald-600' : isPast ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                            {done ? '✅' : isPast ? '⏸' : '⏳'}
                          </span>
                        </div>
                        <p className="text-gray-400 text-[11px] mt-0.5">{dateLabel}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════
            SECTION 6 — CONTACT ENTREPRISE
        ══════════════════════════════════════ */}
        {(entreprise?.telephone || whatsappUrl) && (
          <section className="bg-orange-500 rounded-2xl p-5 text-white">
            <h2 className="text-[16px] font-bold mb-1">Une question sur votre chantier ?</h2>
            <p className="text-orange-100 text-[13px] mb-5">Notre équipe est disponible pour vous répondre.</p>
            <div className="space-y-3">
              {entreprise?.telephone && (
                <a
                  href={`tel:${entreprise.telephone}`}
                  className="flex items-center gap-3 bg-white/10 hover:bg-white/20 rounded-xl px-4 py-3 transition-colors"
                >
                  <span className="text-xl">📱</span>
                  <span className="font-semibold text-[14px]">{entreprise.telephone}</span>
                </a>
              )}
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2.5 bg-white text-orange-500 font-bold text-[14px] py-3.5 rounded-xl hover:bg-orange-50 transition-colors shadow-sm"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Nous contacter sur WhatsApp
                </a>
              )}
            </div>
          </section>
        )}

        {/* ── FOOTER ── */}
        <footer className="py-6 text-center">
          <p className="text-gray-400 text-[12px]">
            Suivi en temps réel propulsé par{' '}
            <a href="https://saas-btp-mali.vercel.app" target="_blank" rel="noopener noreferrer" className="font-bold text-orange-500 hover:text-orange-600 transition-colors">
              BTP Mali
            </a>
          </p>
        </footer>

      </div>
    </div>
  )
}
