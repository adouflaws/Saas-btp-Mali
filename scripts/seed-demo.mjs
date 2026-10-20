#!/usr/bin/env node
// ============================================================
// Compte de démonstration BTP Mali
// ============================================================
// Crée (ou recrée) une entreprise fictive complète pour les démos commerciales :
// chantiers, équipes, pointages, paie, devis, factures, créances, stock, carburant.
// Toutes les dates sont calculées par rapport au jour où le script est lancé,
// donc relancer avec --reset la veille d'une démo « rafraîchit » le compte.
//
// Usage :
//   node scripts/seed-demo.mjs --email demo@btpmali.com --password "MotDePasse123!"
//   node scripts/seed-demo.mjs --email demo@btpmali.com --password "..." --entreprise "Alliance BTP SAS" --telephone "+223 76 00 00 00" --reset
//   node scripts/seed-demo.mjs --email demo@btpmali.com --delete      (supprime le compte démo et ses données)
//
// Options :
//   --email       email du compte démo (obligatoire)
//   --password    mot de passe (obligatoire sauf --delete)
//   --entreprise  nom affiché (défaut : "Sahel Construction SARL")
//   --telephone   numéro WhatsApp de l'entreprise, utilisé par le portail client
//   --photos      dossier d'images .jpg/.png à attacher aux chantiers (optionnel)
//   --reset       efface d'abord les données existantes de CE compte démo
//   --delete      supprime le compte démo et ses données, puis s'arrête
//
// Sécurité : le script n'efface JAMAIS que l'entreprise rattachée à l'email démo.
// Il refuse de tourner sur un email qui possède déjà des données sans --reset.
// ============================================================

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, extname, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/* ── Arguments ── */
const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue
  const key = argv[i].slice(2)
  const next = argv[i + 1]
  if (next === undefined || next.startsWith('--')) args[key] = true
  else { args[key] = next; i++ }
}

const EMAIL = args.email
const PASSWORD = args.password
const NOM_ENTREPRISE = args.entreprise || 'Sahel Construction SARL'
const TELEPHONE = args.telephone || '+223 76 00 00 00'

if (!EMAIL || (!PASSWORD && !args.delete)) {
  console.error('Usage : node scripts/seed-demo.mjs --email <email> --password <mdp> [--entreprise "Nom"] [--telephone "+223..."] [--photos dossier] [--reset]')
  process.exit(1)
}
if (EMAIL === 'adouflaws@gmail.com') {
  console.error('Refusé : ce compte est le super admin, utilisez un email dédié à la démo.')
  process.exit(1)
}

/* ── Env (.env.local) ── */
const env = {}
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/^﻿/, '')
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY
if (!URL || !KEY) { console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans .env.local'); process.exit(1) }

const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/* ── Helpers ── */
const TODAY = new Date(); TODAY.setHours(12, 0, 0, 0)
const pad = n => String(n).padStart(2, '0')
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const day = offset => { const d = new Date(TODAY); d.setDate(d.getDate() + offset); return fmt(d) }
const iso = offset => { const d = new Date(TODAY); d.setDate(d.getDate() + offset); d.setHours(9 + Math.abs(offset % 8), 15, 0, 0); return d.toISOString() }
const finDeMois = (y, m) => fmt(new Date(y, m + 1, 0)) // m = 0..11
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

// Générateur pseudo-aléatoire déterministe : les mêmes données à chaque exécution
let seed = 20261020
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const tva = ht => Math.round(ht * 0.18)

async function must(promise, label) {
  const { data, error } = await promise
  if (error) { console.error(`✗ ${label} : ${error.message}`); process.exit(1) }
  return data
}
async function insert(table, rows, label = table) {
  if (Array.isArray(rows) && rows.length === 0) return []
  const out = []
  const list = Array.isArray(rows) ? rows : [rows]
  for (let i = 0; i < list.length; i += 500) {
    const data = await must(sb.from(table).insert(list.slice(i, i + 500)).select(), `insertion ${label}`)
    out.push(...data)
  }
  return Array.isArray(rows) ? out : out[0]
}

/* ── Utilisateur démo ── */
async function findUser(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const u = data.users.find(x => x.email?.toLowerCase() === email.toLowerCase())
    if (u) return u
    if (data.users.length < 200) return null
  }
  return null
}

async function wipeEntreprise(eid) {
  const chantiers = await must(sb.from('chantiers').select('id').eq('entreprise_id', eid), 'lecture chantiers')
  const cids = chantiers.map(c => c.id)
  const devis = await must(sb.from('devis').select('id').eq('entreprise_id', eid), 'lecture devis')
  const dids = devis.map(d => d.id)
  const ouvriers = await must(sb.from('ouvriers').select('id').eq('entreprise_id', eid), 'lecture ouvriers')
  const oids = ouvriers.map(o => o.id)
  const vehicules = await must(sb.from('vehicules').select('id').eq('entreprise_id', eid), 'lecture véhicules')
  const vids = vehicules.map(v => v.id)

  const del = (table, col, val) => must(
    Array.isArray(val) ? sb.from(table).delete().in(col, val.length ? val : ['00000000-0000-0000-0000-000000000000']) : sb.from(table).delete().eq(col, val),
    `suppression ${table}`,
  )
  await del('relances', 'entreprise_id', eid)
  await del('relances_factures', 'entreprise_id', eid)
  await del('factures', 'entreprise_id', eid)
  await del('budget_previsionnel', 'entreprise_id', eid)
  await del('lignes_devis', 'devis_id', dids)
  await del('devis', 'entreprise_id', eid)
  await del('depenses', 'entreprise_id', eid)
  await del('mouvements_stock', 'entreprise_id', eid)
  await del('materiaux_stock', 'entreprise_id', eid)
  await del('pleins_carburant', 'vehicule_id', vids)
  await del('vehicules', 'entreprise_id', eid)
  await del('pointages', 'chantier_id', cids)
  await del('pointages', 'ouvrier_id', oids)
  await del('avances_salaire', 'entreprise_id', eid)
  await del('affectations_chantier', 'entreprise_id', eid)
  await del('photos_chantier', 'chantier_id', cids)
  await del('jalons', 'chantier_id', cids)
  await del('taches', 'chantier_id', cids)
  await del('chantier_membres', 'chantier_id', cids)
  await del('chantiers', 'entreprise_id', eid)
  await del('ouvriers', 'entreprise_id', eid)
  await del('tarifs_personnalises', 'entreprise_id', eid)
  await del('modeles_devis', 'entreprise_id', eid)
  await del('compteurs_documents', 'entreprise_id', eid)
}

async function main() {
  console.log(`\nBTP Mali — compte démo « ${NOM_ENTREPRISE} » (${EMAIL})\n`)

  let user = await findUser(EMAIL)

  if (args.delete) {
    if (!user) { console.log('Aucun compte démo trouvé, rien à supprimer.'); return }
    const p = await must(sb.from('profiles').select('entreprise_id').eq('id', user.id).maybeSingle(), 'lecture profil')
    if (p?.entreprise_id) {
      await wipeEntreprise(p.entreprise_id)
      await must(sb.from('abonnements').delete().eq('entreprise_id', p.entreprise_id), 'suppression abonnements')
    }
    await must(sb.from('profiles').delete().eq('id', user.id), 'suppression profil')
    if (p?.entreprise_id) await must(sb.from('entreprises').delete().eq('id', p.entreprise_id), 'suppression entreprise')
    const { error } = await sb.auth.admin.deleteUser(user.id)
    if (error) throw error
    console.log('✓ Compte démo supprimé.')
    return
  }

  /* 1. Compte + entreprise */
  if (!user) {
    const { data, error } = await sb.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { nom: 'Coulibaly', entreprise: NOM_ENTREPRISE, telephone: TELEPHONE },
    })
    if (error) throw error
    user = data.user
    console.log('✓ Compte créé')
  } else {
    const { error } = await sb.auth.admin.updateUserById(user.id, { password: PASSWORD })
    if (error) throw error
    console.log('✓ Compte existant, mot de passe mis à jour')
  }

  // Le trigger d'inscription crée normalement entreprise + profil ; on attend un peu puis on complète.
  let profile = null
  for (let i = 0; i < 10 && !profile?.entreprise_id; i++) {
    profile = await must(sb.from('profiles').select('id, entreprise_id').eq('id', user.id).maybeSingle(), 'lecture profil')
    if (!profile?.entreprise_id) await new Promise(r => setTimeout(r, 500))
  }

  let eid = profile?.entreprise_id
  if (!eid) {
    const ent = await insert('entreprises', { nom: NOM_ENTREPRISE })
    eid = ent.id
    if (profile) await must(sb.from('profiles').update({ entreprise_id: eid }).eq('id', user.id), 'liaison profil')
    else await insert('profiles', { id: user.id, entreprise_id: eid, nom: 'Coulibaly', prenom: 'Amadou', role: 'admin' })
  }

  const existing = await must(sb.from('chantiers').select('id', { count: 'exact', head: false }).eq('entreprise_id', eid), 'lecture chantiers')
  if (existing.length > 0) {
    if (!args.reset) { console.error('Ce compte démo contient déjà des données. Relancez avec --reset pour les remplacer.'); process.exit(1) }
    await wipeEntreprise(eid)
    console.log('✓ Anciennes données démo effacées')
  }

  await must(sb.from('profiles').update({ nom: 'Coulibaly', prenom: 'Amadou', telephone: TELEPHONE }).eq('id', user.id), 'profil')
  await must(sb.from('entreprises').update({
    nom: NOM_ENTREPRISE,
    telephone: TELEPHONE,
    email: EMAIL,
    adresse: 'Rue 312, Porte 47, Hamdallaye ACI 2000',
    ville: 'Bamako',
    rccm: 'MA.BKO.2018.B.4721',
    nif: '084512763P',
    plan: 'pro',
    actif: true,
    statut_abonnement: 'actif',
    date_fin_abonnement: day(365),
    onboarding_complete: true,
    onboarding_step: 4,
  }).eq('id', eid), 'entreprise')
  console.log('✓ Entreprise configurée (abonnement actif, onboarding terminé)')

  /* 2. Chantiers */
  const CH = [
    { key: 'villa', nom: 'Villa R+1 — Famille Traoré', description: 'Villa R+1 de 6 pièces avec terrasse et clôture', client_nom: 'Moussa Traoré', client_telephone: '+223 66 41 27 85', client_email: 'moussa.traore@example.com', adresse: 'Kalaban Coura ACI, près du marché', ville: 'Bamako', statut: 'en_cours', date_debut: day(-118), date_fin_prevue: day(95), budget_prevu: 85_000_000, avancement: 62, portail_actif: true },
    { key: 'immeuble', nom: 'Immeuble R+3 — ACI 2000', description: 'Immeuble de bureaux R+3, 1 200 m² de plancher', client_nom: 'SCI Baobab Invest', client_telephone: '+223 20 22 48 10', client_email: 'contact@baobab-invest.example', adresse: 'ACI 2000, avenue du Mali', ville: 'Bamako', statut: 'en_cours', date_debut: day(-150), date_fin_prevue: day(240), budget_prevu: 240_000_000, avancement: 38, portail_actif: true },
    { key: 'ecole', nom: 'Clôture et forage — École de Sébénikoro', description: 'Mur de clôture 420 ml, portail, forage équipé', client_nom: 'Mairie de la Commune IV', client_telephone: '+223 20 29 14 60', adresse: 'Sébénikoro, Commune IV', ville: 'Bamako', statut: 'en_cours', date_debut: day(-70), date_fin_prevue: day(20), budget_prevu: 18_500_000, avancement: 85, portail_actif: false, marche_public: true, numero_marche: 'MP-CIV-2026-017' },
    { key: 'magasin', nom: 'Magasin de stockage — Halle de Bamako', description: 'Hangar métallique 600 m² sur dallage', client_nom: 'Ets Diarra & Frères', client_telephone: '+223 76 18 52 03', adresse: 'Halle de Bamako, Commune VI', ville: 'Bamako', statut: 'termine', date_debut: day(-260), date_fin_prevue: day(-60), date_fin_reelle: day(-52), budget_prevu: 32_000_000, avancement: 100, portail_actif: false },
    { key: 'duplex', nom: 'Duplex — Sotuba', description: 'Duplex 4 chambres, en attente de validation du devis', client_nom: 'Aïssata Keïta', client_telephone: '+223 79 05 33 61', adresse: 'Sotuba ACI', ville: 'Bamako', statut: 'preparation', date_debut: day(30), date_fin_prevue: day(300), budget_prevu: 61_000_000, avancement: 0, portail_actif: false },
  ]
  const chantierRows = await insert('chantiers', CH.map(({ key, ...c }) => ({ ...c, entreprise_id: eid, marche_public: c.marche_public ?? false })))
  const C = Object.fromEntries(CH.map((c, i) => [c.key, chantierRows[i]]))
  console.log(`✓ ${chantierRows.length} chantiers`)

  /* 3. Ouvriers */
  const METIERS = {
    chef: ["Chef d'équipe", 12_500], macon: ['Maçon', 7_500], ferrailleur: ['Ferrailleur', 7_000], coffreur: ['Coffreur', 7_000],
    electricien: ['Électricien', 10_000], plombier: ['Plombier', 9_000], carreleur: ['Carreleur', 8_000], peintre: ['Peintre', 7_000],
    chauffeur: ['Chauffeur', 6_500], manoeuvre: ['Manœuvre', 3_500],
  }
  const OUV = [
    ['Diarra', 'Seydou', 'chef', 'villa'], ['Traoré', 'Bakary', 'macon', 'villa'], ['Coulibaly', 'Lassine', 'macon', 'villa'], ['Keïta', 'Mamadou', 'ferrailleur', 'villa'],
    ['Sangaré', 'Drissa', 'carreleur', 'villa'], ['Doumbia', 'Adama', 'electricien', 'villa'], ['Konaté', 'Souleymane', 'manoeuvre', 'villa'], ['Sidibé', 'Moussa', 'manoeuvre', 'villa'],
    ['Camara', 'Ibrahim', 'manoeuvre', 'villa'],
    ['Dembélé', 'Oumar', 'chef', 'immeuble'], ['Touré', 'Modibo', 'macon', 'immeuble'], ['Samaké', 'Yacouba', 'macon', 'immeuble'], ['Bagayoko', 'Siaka', 'macon', 'immeuble'],
    ['Cissé', 'Abdoulaye', 'ferrailleur', 'immeuble'], ['Maïga', 'Hamidou', 'ferrailleur', 'immeuble'], ['Kanté', 'Boubacar', 'coffreur', 'immeuble'], ['Fofana', 'Mahamadou', 'coffreur', 'immeuble'],
    ['Sylla', 'Karim', 'plombier', 'immeuble'], ['Ballo', 'Sékou', 'manoeuvre', 'immeuble'], ['Dao', 'Issa', 'manoeuvre', 'immeuble'], ['Guindo', 'Amadou', 'manoeuvre', 'immeuble'],
    ['Togola', 'Daouda', 'manoeuvre', 'immeuble'],
    ['Kouyaté', 'Sidiki', 'chef', 'ecole'], ['Mariko', 'Fousseyni', 'macon', 'ecole'], ['Dicko', 'Hama', 'macon', 'ecole'], ['Berthé', 'Lamine', 'manoeuvre', 'ecole'],
    ['Haïdara', 'Ousmane', 'manoeuvre', 'ecole'], ['Diallo', 'Alou', 'peintre', 'ecole'],
    ['Sanogo', 'Mady', 'chauffeur', null], ['Konaré', 'Brahima', 'chauffeur', null],
  ]
  const ouvrierRows = await insert('ouvriers', OUV.map(([nom, prenom, m], i) => ({
    entreprise_id: eid, nom, prenom, metier: METIERS[m][0], taux_journalier: METIERS[m][1], type_contrat: 'journalier', actif: true,
    telephone: `+223 7${(i % 9) + 1} ${pad(10 + i * 3 % 89)} ${pad(20 + i * 7 % 79)} ${pad(30 + i * 11 % 69)}`,
    date_embauche: day(-400 - i * 23), adresse: ['Kalaban Coura', 'Sébénikoro', 'Niamakoro', 'Banconi', 'Lafiabougou', 'Sogoniko'][i % 6],
  })))
  const ouvriers = ouvrierRows.map((o, i) => ({ ...o, chantier: OUV[i][3] }))
  console.log(`✓ ${ouvriers.length} ouvriers`)

  await insert('affectations_chantier', ouvriers.filter(o => o.chantier).map(o => ({
    entreprise_id: eid, chantier_id: C[o.chantier].id, ouvrier_id: o.id, date_debut: C[o.chantier].date_debut, actif: true,
  })))

  /* 4. Pointages : 50 derniers jours ouvrés (lundi-samedi).
        Aujourd'hui, la Villa reste VIDE exprès : c'est le pointage à faire en direct pendant la démo. */
  const pointages = []
  const debutPointage = -50
  for (let off = debutPointage; off <= 0; off++) {
    const d = new Date(TODAY); d.setDate(d.getDate() + off)
    if (d.getDay() === 0) continue
    for (const o of ouvriers) {
      if (!o.chantier) continue
      if (off === 0 && o.chantier === 'villa') continue
      const r = rand()
      const statut = r < 0.86 ? 'present' : r < 0.92 ? 'demi_journee' : r < 0.95 ? 'maladie' : 'absent'
      const montant = statut === 'present' ? o.taux_journalier : statut === 'demi_journee' ? Math.round(o.taux_journalier / 2) : 0
      pointages.push({
        chantier_id: C[o.chantier].id, ouvrier_id: o.id, date_pointage: fmt(d),
        present: statut === 'present' || statut === 'demi_journee', statut_presence: statut, montant_jour: montant,
        note: statut === 'maladie' ? 'Paludisme, certificat fourni' : null, saisi_par: user.id,
      })
    }
  }
  await insert('pointages', pointages)
  console.log(`✓ ${pointages.length} pointages`)

  /* 5. Avances sur salaire (mois en cours, non remboursées → déduites de la paie) */
  const av = [[1, 'villa', 25_000, 'Frais de scolarité'], [10, 'immeuble', 40_000, 'Baptême'], [13, 'immeuble', 15_000, 'Transport'], [24, 'ecole', 20_000, 'Ordonnance médicale']]
  const debutMoisOff = -(TODAY.getDate() - 1)
  await insert('avances_salaire', av.map(([idx, ch, montant, motif], i) => ({
    entreprise_id: eid, ouvrier_id: ouvriers[idx].id, chantier_id: C[ch].id, montant, motif, rembourse: false,
    date_avance: day(Math.max(debutMoisOff, -2 - i * 3)),
  })))

  /* 6. Paie du mois précédent validée (dépense auto_paie datée du dernier jour du mois) */
  const prev = new Date(TODAY.getFullYear(), TODAY.getMonth() - 1, 1)
  const prevKey = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`
  const depenses = []
  for (const key of ['villa', 'immeuble', 'ecole']) {
    const total = pointages.filter(p => p.chantier_id === C[key].id && p.present && p.date_pointage.startsWith(prevKey)).reduce((s, p) => s + p.montant_jour, 0)
    if (total > 0) depenses.push({
      chantier_id: C[key].id, categorie: 'main_oeuvre', description: `Paie ouvriers — ${MOIS[prev.getMonth()]} ${prev.getFullYear()}`,
      montant: total, date_depense: finDeMois(prev.getFullYear(), prev.getMonth()), source: 'auto_paie',
    })
  }

  /* 7. Dépenses antérieures au logiciel + achats directs, sous-traitance, location matériel */
  const D = (key, categorie, description, fournisseur, montant, off) => depenses.push({ chantier_id: C[key].id, categorie, description, fournisseur, montant, date_depense: day(off) })
  // Villa — tenue du budget
  D('villa', 'main_oeuvre', "Main d'œuvre fondations et élévation (avant mise en place du logiciel)", null, 6_850_000, -60)
  D('villa', 'materiaux', 'Ciment CPA 45 — 320 sacs', 'Diamond Cement Mali', 1_600_000, -110)
  D('villa', 'materiaux', 'Fer à béton HA8/HA10/HA12', 'Quincaillerie Bah & Fils', 4_950_000, -104)
  D('villa', 'materiaux', 'Agglos 15 creux — 6 500 unités', 'Briqueterie de Kalaban', 2_925_000, -90)
  D('villa', 'materiaux', 'Sable et gravier — 14 voyages', 'Carrière de Kati', 2_380_000, -95)
  D('villa', 'materiaux', 'Hourdis et poutrelles plancher R+1', 'Préfa Mali', 5_400_000, -55)
  D('villa', 'materiel', 'Location bétonnière + vibreur (3 semaines)', 'Loc-Engins Bamako', 450_000, -52)
  D('villa', 'sous_traitance', 'Étanchéité terrasse', 'Étanch-Pro', 1_850_000, -12)
  D('villa', 'autre', 'Gardiennage chantier — 3 mois', 'Sécurité Plus', 540_000, -15)
  // Immeuble — dépassement sur les matériaux (le chantier « qui inquiète »)
  D('immeuble', 'main_oeuvre', "Main d'œuvre terrassement et fondations (avant mise en place du logiciel)", null, 11_200_000, -60)
  D('immeuble', 'materiaux', 'Béton prêt à l\'emploi — fondations (185 m³)', 'Béton Express Mali', 17_575_000, -135)
  D('immeuble', 'materiaux', 'Fer à béton — fondations et poteaux (24 t)', 'Sonatam', 18_960_000, -128)
  D('immeuble', 'materiaux', 'Béton prêt à l\'emploi — dalle haute RDC (142 m³)', 'Béton Express Mali', 13_490_000, -62)
  D('immeuble', 'materiaux', 'Fer à béton — dalle R+1 (complément, prix en hausse)', 'Sonatam', 9_870_000, -24)
  D('immeuble', 'materiaux', 'Coffrage bois et étais — rachat après vol', 'Bois du Mandé', 3_150_000, -18)
  D('immeuble', 'materiel', 'Location grue mobile — 2 semaines', 'Loc-Engins Bamako', 4_200_000, -70)
  D('immeuble', 'materiel', 'Location pompe à béton', 'Béton Express Mali', 1_300_000, -61)
  D('immeuble', 'sous_traitance', 'Terrassement et évacuation des déblais', 'TP Sahel', 6_800_000, -142)
  D('immeuble', 'autre', 'Gardiennage + éclairage chantier — 5 mois', 'Sécurité Plus', 1_250_000, -10)
  // École — marché public serré
  D('ecole', 'main_oeuvre', "Main d'œuvre fouilles et semelles (avant mise en place du logiciel)", null, 1_480_000, -55)
  D('ecole', 'materiaux', 'Agglos 20 pleins — 5 200 unités', 'Briqueterie de Kalaban', 2_860_000, -64)
  D('ecole', 'materiaux', 'Ciment CPA 45 — 410 sacs', 'Diamond Cement Mali', 2_050_000, -63)
  D('ecole', 'sous_traitance', 'Forage 80 m + pompe immergée solaire', 'Hydro-Forage Mali', 4_750_000, -30)
  D('ecole', 'materiaux', 'Portail métallique 6 m', 'Soudure Moderne', 850_000, -9)
  // Magasin (terminé, rentable)
  D('magasin', 'main_oeuvre', "Main d'œuvre complète du chantier", null, 5_940_000, -60)
  D('magasin', 'materiaux', 'Charpente et bardage métallique', 'Métal Sahel', 9_800_000, -200)
  D('magasin', 'materiaux', 'Dallage béton 600 m²', 'Béton Express Mali', 4_650_000, -180)
  D('magasin', 'sous_traitance', 'Électricité industrielle', 'Élec-Pro Mali', 2_100_000, -90)
  D('magasin', 'transport', 'Transport charpente depuis Dakar', 'Transit Kankou', 1_150_000, -210)

  /* 8. Stock + mouvements (sorties → dépenses auto_stock) */
  const MAT = [
    ['Ciment CPA 45 (sac 50 kg)', 'sac', 185, 150, 5_000],
    ['Fer à béton HA10 (barre 12 m)', 'barre', 64, 80, 4_600],
    ['Fer à béton HA12 (barre 12 m)', 'barre', 142, 80, 6_700],
    ['Sable de rivière', 'm³', 38, 20, 11_500],
    ['Gravier 15/25', 'm³', 9, 15, 16_000],
    ['Agglos 15 creux', 'unité', 2_400, 1_000, 450],
    ['Carreaux grès 40×40', 'm²', 210, 50, 7_500],
    ['Peinture vinylique (seau 20 L)', 'seau', 14, 6, 32_000],
    ['Tuyau PVC Ø110 (barre 4 m)', 'barre', 3, 10, 9_500],
  ]
  const stock = await insert('materiaux_stock', MAT.map(([nom, unite, quantite_stock, quantite_min, prix_unitaire]) => ({ entreprise_id: eid, nom, unite, quantite_stock, quantite_min, prix_unitaire })))
  const S = Object.fromEntries(stock.map(s => [s.nom.split(' (')[0], s]))
  const mouvements = [
    ['Ciment CPA 45', null, 'entree', 400, -28, 'Diamond Cement Mali', 'Commande mensuelle'],
    ['Fer à béton HA12', null, 'entree', 300, -26, 'Sonatam', null],
    ['Agglos 15 creux', null, 'entree', 6_000, -21, 'Briqueterie de Kalaban', null],
    ['Carreaux grès 40×40', null, 'entree', 380, -19, 'Céramique du Sahel', null],
    ['Ciment CPA 45', 'villa', 'sortie', 60, -18, null, 'Chape RDC'],
    ['Fer à béton HA12', 'immeuble', 'sortie', 110, -16, null, 'Poutres R+1'],
    ['Agglos 15 creux', 'villa', 'sortie', 2_200, -14, null, 'Élévation étage'],
    ['Ciment CPA 45', 'immeuble', 'sortie', 95, -11, null, 'Poteaux R+1'],
    ['Carreaux grès 40×40', 'villa', 'sortie', 170, -6, null, 'Carrelage salon + chambres RDC'],
    ['Agglos 15 creux', 'ecole', 'sortie', 1_400, -5, null, 'Dernier tronçon de clôture'],
    ['Gravier 15/25', 'immeuble', 'sortie', 12, -3, null, 'Béton poteaux'],
    ['Ciment CPA 45', 'ecole', 'sortie', 60, -2, null, 'Enduits clôture'],
    ['Fer à béton HA10', 'immeuble', 'sortie', 48, -1, null, 'Chaînages'],
  ]
  for (const [mat, ch, type, quantite, off, fournisseur, motif] of mouvements) {
    const m = S[mat]
    const mv = await insert('mouvements_stock', {
      entreprise_id: eid, materiau_id: m.id, chantier_id: ch ? C[ch].id : null, type, quantite, prix_unitaire: m.prix_unitaire,
      fournisseur, motif, created_by: user.id, created_at: iso(off),
    })
    if (type === 'sortie') depenses.push({
      chantier_id: C[ch].id, categorie: 'materiaux', description: `${m.nom} × ${quantite} ${m.unite}`,
      montant: quantite * m.prix_unitaire, date_depense: day(off), source: 'auto_stock', source_id: mv.id,
    })
  }
  console.log(`✓ ${stock.length} matériaux en stock (3 sous le seuil d'alerte), ${mouvements.length} mouvements`)

  /* 9. Véhicules + pleins de carburant (gasoil ~ 800 FCFA/L) */
  const vehs = await insert('vehicules', [
    { entreprise_id: eid, nom: 'Camion benne Sinotruk', immatriculation: 'AB 4521 MD', type: 'camion', actif: true },
    { entreprise_id: eid, nom: 'Toyota Hilux', immatriculation: 'AC 1187 MD', type: 'pick_up', actif: true },
    { entreprise_id: eid, nom: 'Bétonnière autotractée', immatriculation: 'EN-03', type: 'engin', actif: true },
  ])
  const PLEINS = [
    // [vehicule, chantier, offset, litres, km, station]
    [0, 'immeuble', -55, 180, 84_210, 'Total ACI 2000'], [1, 'villa', -52, 70, 121_450, 'Shell Kalaban'], [0, 'villa', -47, 175, 84_890, 'Total ACI 2000'],
    [2, 'immeuble', -44, 60, null, 'Livraison bidons'], [1, 'ecole', -40, 65, 122_180, 'Oryx Sébénikoro'], [0, 'immeuble', -37, 185, 85_610, 'Total ACI 2000'],
    [1, 'villa', -31, 72, 122_960, 'Shell Kalaban'], [0, 'immeuble', -27, 180, 86_300, 'Total ACI 2000'], [2, 'immeuble', -24, 55, null, 'Livraison bidons'],
    [1, 'ecole', -20, 68, 123_740, 'Oryx Sébénikoro'], [0, 'villa', -16, 178, 87_020, 'Total ACI 2000'],
    // Le plein « qui fait lever les sourcils » : 240 L pour un réservoir de 200 L, 180 km seulement depuis le précédent
    [0, 'immeuble', -9, 240, 87_200, 'Station non habituelle — Niamakoro'],
    [1, 'villa', -6, 70, 124_510, 'Shell Kalaban'], [2, 'immeuble', -4, 58, null, 'Livraison bidons'], [1, 'ecole', -2, 66, 125_290, 'Oryx Sébénikoro'],
  ]
  for (const [v, ch, off, litres, km, station] of PLEINS) {
    const montant = litres * 800
    const p = await insert('pleins_carburant', {
      vehicule_id: vehs[v].id, chantier_id: C[ch].id, entreprise_id: eid, date_plein: day(off), litres, montant, kilometrage: km, station, saisi_par: user.id,
    })
    depenses.push({
      chantier_id: C[ch].id, categorie: 'transport', description: `Carburant ${vehs[v].nom} — ${litres}L`,
      montant, date_depense: day(off), source: 'auto_carburant', source_id: p.id,
    })
  }
  console.log(`✓ ${vehs.length} véhicules, ${PLEINS.length} pleins`)

  await insert('depenses', depenses.map(d => ({ ...d, entreprise_id: eid, saisi_par: user.id })))
  console.log(`✓ ${depenses.length} dépenses`)

  /* 10. Bibliothèque de prix */
  await insert('tarifs_personnalises', [
    ['Béton dosé à 350 kg/m³', 95_000, 'm³'], ['Maçonnerie agglos 15', 9_500, 'm²'], ['Enduit ciment intérieur', 3_500, 'm²'],
    ['Carrelage grès 40×40 posé', 14_500, 'm²'], ['Peinture vinylique 2 couches', 2_800, 'm²'], ['Fer à béton façonné posé', 950_000, 't'],
    ['Point lumineux', 22_000, 'u'], ['Prise de courant', 18_000, 'u'],
  ].map(([designation, prix_unitaire, unite]) => ({ entreprise_id: eid, designation, prix_unitaire, unite })))

  /* 11. Devis + lignes */
  const DEVIS = [
    { n: 1, ch: 'magasin', statut: 'converti', off: -265, lignes: [
      ['Terrassement et fondations', 'forfait', 1, 3_900_000, 'gros_oeuvre'], ['Dallage béton armé 600 m²', 'm²', 600, 11_000, 'gros_oeuvre'],
      ['Charpente et bardage métallique', 'forfait', 1, 15_200_000, 'charpente'], ['Électricité industrielle', 'forfait', 1, 3_100_000, 'second_oeuvre']] },
    { n: 2, ch: 'villa', statut: 'converti', off: -125, lignes: [
      ['Fondations et soubassement', 'forfait', 1, 9_800_000, 'gros_oeuvre'], ['Élévation RDC + R+1 (agglos 15)', 'm²', 760, 9_500, 'gros_oeuvre'],
      ['Planchers hourdis RDC et R+1', 'm²', 290, 38_000, 'gros_oeuvre'], ['Enduits intérieurs et extérieurs', 'm²', 1_480, 3_500, 'second_oeuvre'],
      ['Carrelage grès 40×40 posé', 'm²', 260, 14_500, 'second_oeuvre'], ['Électricité complète', 'forfait', 1, 4_200_000, 'second_oeuvre'],
      ['Plomberie et sanitaires', 'forfait', 1, 3_900_000, 'second_oeuvre'], ['Menuiseries alu et bois', 'forfait', 1, 6_100_000, 'second_oeuvre'],
      ['Peinture 2 couches', 'm²', 1_480, 2_800, 'finitions'], ['Étanchéité terrasse', 'm²', 145, 12_500, 'finitions']] },
    { n: 3, ch: 'immeuble', statut: 'converti', off: -160, lignes: [
      ['Terrassement et fondations profondes', 'forfait', 1, 38_000_000, 'gros_oeuvre'], ['Structure béton armé R+3', 'm³', 820, 95_000, 'gros_oeuvre'],
      ['Maçonnerie', 'm²', 2_600, 9_500, 'gros_oeuvre'], ['Second œuvre (électricité, plomberie, climatisation)', 'forfait', 1, 46_000_000, 'second_oeuvre'],
      ['Façade et finitions', 'forfait', 1, 21_500_000, 'finitions']] },
    { n: 4, ch: 'ecole', statut: 'accepte', off: -75, signe: { par: 'M. Bréhima Sissoko, Secrétaire général', off: -3 }, lignes: [
      ['Mur de clôture agglos 20 — 420 ml × 2,5 m', 'm²', 1_050, 9_800, 'gros_oeuvre'], ['Portail métallique 6 m', 'u', 1, 1_150_000, 'menuiserie'],
      ['Forage 80 m équipé pompe solaire', 'forfait', 1, 5_600_000, 'forage']] },
    { n: 5, ch: 'duplex', statut: 'envoye', off: -19, lignes: [
      ['Gros œuvre complet', 'forfait', 1, 29_000_000, 'gros_oeuvre'], ['Second œuvre', 'forfait', 1, 17_500_000, 'second_oeuvre'],
      ['Finitions et peinture', 'forfait', 1, 6_200_000, 'finitions']] },
    { n: 6, ch: null, statut: 'envoye', off: -4, client: ['Clinique Les Palmiers', '+223 20 21 77 40'], lignes: [
      ['Réhabilitation bloc opératoire — démolition', 'forfait', 1, 2_400_000, 'gros_oeuvre'], ['Carrelage antibactérien', 'm²', 180, 21_000, 'second_oeuvre'],
      ['Électricité et éclairage médical', 'forfait', 1, 5_800_000, 'second_oeuvre']] },
    { n: 7, ch: null, statut: 'brouillon', off: -1, client: ['Boutique Fatoumata Bah', '+223 65 44 10 92'], lignes: [
      ['Aménagement boutique 45 m²', 'forfait', 1, 3_400_000, 'second_oeuvre'], ['Vitrine alu', 'u', 1, 850_000, 'menuiserie']] },
    { n: 8, ch: null, statut: 'refuse', off: -40, client: ['Hôtel Le Fleuve', '+223 20 23 05 18'], lignes: [
      ['Extension 12 chambres — gros œuvre', 'forfait', 1, 48_000_000, 'gros_oeuvre']] },
  ]
  const devisRows = {}
  for (const d of DEVIS) {
    const ht = d.lignes.reduce((s, [, , q, pu]) => s + Math.round(q * pu), 0)
    const ch = d.ch ? C[d.ch] : null
    const row = await insert('devis', {
      entreprise_id: eid, chantier_id: ch?.id ?? null, numero: `DEV-${pad(d.n).padStart(3, '0')}`, statut: d.statut,
      montant_ht: ht, tva_taux: 18, montant_tva: tva(ht), montant_ttc: ht + tva(ht),
      date_emission: day(d.off), date_validite: day(d.off + 30), notes: 'Validité 30 jours. Acompte de 30 % à la commande.',
      cree_par: user.id, created_at: iso(d.off),
      client_nom: ch?.client_nom ?? d.client[0], client_telephone: ch?.client_telephone ?? d.client[1],
      signe_par: d.signe?.par ?? null, date_signature: d.signe ? iso(d.signe.off) : null,
    })
    await insert('lignes_devis', d.lignes.map(([designation, unite, quantite, prix_unit, categorie], i) => ({
      devis_id: row.id, designation, unite, quantite, prix_unit, total: Math.round(quantite * prix_unit), ordre: i, categorie,
    })))
    devisRows[d.n] = row
  }
  console.log(`✓ ${DEVIS.length} devis (dont 1 signé cette semaine, 1 sans réponse depuis 19 jours)`)

  /* 12. Budget prévisionnel (comparé aux dépenses réelles dans la fiche chantier) */
  const BP = {
    villa: [['materiaux', 38_000_000], ['main_oeuvre', 21_000_000], ['materiel', 2_500_000], ['transport', 1_800_000], ['sous_traitance', 6_500_000], ['autre', 1_500_000]],
    immeuble: [['materiaux', 112_000_000], ['main_oeuvre', 58_000_000], ['materiel', 14_000_000], ['transport', 4_000_000], ['sous_traitance', 22_000_000], ['autre', 4_000_000]],
    ecole: [['materiaux', 7_200_000], ['main_oeuvre', 4_100_000], ['sous_traitance', 4_900_000], ['transport', 600_000]],
  }
  await insert('budget_previsionnel', Object.entries(BP).flatMap(([k, rows]) => rows.map(([categorie, montant_prevu]) => ({
    entreprise_id: eid, chantier_id: C[k].id, categorie, montant_prevu, description: 'Budget initial validé',
    devis_id: devisRows[{ villa: 2, immeuble: 3, ecole: 4 }[k]].id,
  }))))

  /* 13. Factures */
  const ttc = ht => ht + tva(ht)
  const F = [
    // [n, chantier, devis, ht, statut, payé, émission, échéance, date paiement]
    [1, 'magasin', 1, 12_000_000, 'paye', null, -250, -235, -238],
    [2, 'magasin', 1, 14_500_000, 'paye', null, -120, -105, -100],
    [3, 'magasin', 1, 4_600_000, 'paye', null, -50, -35, -5],                 // solde encaissé récemment
    [4, 'villa', 2, 21_500_000, 'paye', null, -120, -110, -112],              // acompte 30 %
    [5, 'villa', 2, 18_000_000, 'partiellement_paye', 10_000_000, -40, -10, -14],
    [6, 'immeuble', 3, 62_000_000, 'paye', null, -155, -140, -141],           // acompte
    [7, 'immeuble', 3, 34_000_000, 'en_retard', 0, -48, -22, null],           // situation n°1 en retard (J+22)
    [8, 'ecole', 4, 6_200_000, 'en_retard', 0, -50, -35, null],               // marché public, J+35
    [9, 'ecole', 4, 4_900_000, 'en_attente', 0, -2, 28, null],
  ]
  const facRows = {}
  for (const [n, ch, dv, ht, statut, paye, em, ech, dp] of F) {
    const total = ttc(ht)
    facRows[n] = await insert('factures', {
      entreprise_id: eid, chantier_id: C[ch].id, devis_id: devisRows[dv].id, numero: `FAC-${String(n).padStart(3, '0')}`, statut,
      montant_ht: ht, tva_taux: 18, montant_ttc: total, montant_paye: paye ?? (statut === 'paye' ? total : 0),
      date_emission: day(em), date_echeance: day(ech), date_paiement: dp != null ? iso(dp) : null,
      mode_paiement: statut === 'paye' || paye ? (n % 2 ? 'virement' : 'cheque') : null, created_at: iso(em),
      client_nom: C[ch].client_nom, client_telephone: C[ch].client_telephone, client_email: C[ch].client_email ?? null,
    })
  }
  // Relances déjà envoyées (le niveau suivant reste à envoyer en direct pendant la démo)
  await insert('relances', [
    { facture_id: facRows[7].id, entreprise_id: eid, type: 'whatsapp', niveau: 'j7', envoye_le: iso(-14) },
    { facture_id: facRows[8].id, entreprise_id: eid, type: 'whatsapp', niveau: 'j7', envoye_le: iso(-27) },
    { facture_id: facRows[8].id, entreprise_id: eid, type: 'email', niveau: 'j15', envoye_le: iso(-19), reponse_client: 'Paiement en cours de mandatement au Trésor', date_reponse: iso(-17) },
  ])
  console.log(`✓ ${F.length} factures (2 en retard, 1 partiellement payée), 3 relances`)

  /* 14. Planning : tâches + jalons */
  const T = (key, rows) => rows.map(([nom, statut, avancement, d1, d2, priorite], i) => ({
    chantier_id: C[key].id, nom, statut, avancement, date_debut: day(d1), date_fin_prevue: day(d2), ordre: i, priorite: priorite ?? 'normale',
    date_fin_reelle: statut === 'termine' ? day(Math.min(d2, 0)) : null,
  }))
  await insert('taches', [
    ...T('villa', [['Implantation et fouilles', 'termine', 100, -118, -108], ['Fondations et soubassement', 'termine', 100, -108, -88], ['Élévation RDC', 'termine', 100, -88, -68],
      ['Plancher haut RDC', 'termine', 100, -68, -55], ['Élévation R+1', 'termine', 100, -55, -35], ['Plancher terrasse + étanchéité', 'termine', 100, -35, -10],
      ['Enduits', 'en_cours', 55, -14, 12], ['Électricité et plomberie', 'en_cours', 40, -10, 25], ['Carrelage', 'en_cours', 35, -7, 30],
      ['Menuiseries', 'a_faire', 0, 25, 55], ['Peinture et finitions', 'a_faire', 0, 55, 90]]),
    ...T('immeuble', [['Terrassement', 'termine', 100, -150, -135], ['Fondations profondes', 'termine', 100, -135, -100], ['Structure RDC', 'termine', 100, -100, -62],
      ['Structure R+1', 'en_cours', 70, -62, 6, 'haute'], ['Structure R+2', 'a_faire', 0, 6, 50], ['Structure R+3 et toiture', 'a_faire', 0, 50, 100],
      ['Livraison fer à béton R+2', 'bloque', 0, -5, 3, 'haute']]),
    ...T('ecole', [['Fouilles et semelles', 'termine', 100, -70, -55], ['Élévation clôture', 'termine', 100, -55, -12], ['Forage et pompe', 'termine', 100, -35, -25],
      ['Pose du portail', 'en_cours', 60, -9, 4], ['Enduits et peinture clôture', 'en_cours', 45, -6, 15]]),
  ])
  const J = (key, rows) => rows.map(([nom, off, atteint]) => ({ chantier_id: C[key].id, nom, date_prevue: day(off), atteint, date_reelle: atteint ? day(off + 2) : null, alerte_jours: 7 }))
  await insert('jalons', [
    ...J('villa', [['Fin des fondations', -88, true], ['Dalle R+1 coulée', -55, true], ['Hors d\'eau (terrasse étanche)', -10, true], ['Fin du second œuvre', 45, false], ['Remise des clés', 95, false]]),
    ...J('immeuble', [['Fin des fondations', -100, true], ['Dalle haute RDC', -62, true], ['Dalle haute R+1', 6, false], ['Gros œuvre terminé', 100, false], ['Livraison', 240, false]]),
    ...J('ecole', [['Clôture élevée', -12, true], ['Forage réceptionné', -25, true], ['Réception provisoire', 20, false]]),
  ])
  console.log('✓ Tâches et jalons')

  /* 15. Photos (optionnel) */
  if (args.photos) {
    const dir = resolve(args.photos)
    if (!existsSync(dir)) console.warn(`! Dossier photos introuvable : ${dir}`)
    else {
      const files = readdirSync(dir).filter(f => ['.jpg', '.jpeg', '.png', '.webp'].includes(extname(f).toLowerCase()))
      const cibles = ['villa', 'immeuble', 'ecole']
      for (const [i, f] of files.entries()) {
        const key = cibles[i % cibles.length]
        const path = `${eid}/${C[key].id}/demo-${i}${extname(f).toLowerCase()}`
        const { error } = await sb.storage.from('photos-chantier').upload(path, readFileSync(join(dir, f)), {
          upsert: true, contentType: extname(f).toLowerCase() === '.png' ? 'image/png' : extname(f).toLowerCase() === '.webp' ? 'image/webp' : 'image/jpeg',
        })
        if (error) { console.warn(`! Photo ${f} : ${error.message}`); continue }
        const { data: pub } = sb.storage.from('photos-chantier').getPublicUrl(path)
        await insert('photos_chantier', {
          chantier_id: C[key].id, entreprise_id: eid, prise_par: user.id, url: pub.publicUrl,
          legende: f.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), prise_le: iso(-i * 4),
        })
      }
      console.log(`✓ ${files.length} photos`)
    }
  }

  /* Récapitulatif */
  const site = env.NEXT_PUBLIC_SITE_URL || 'https://saas-btp-mali.vercel.app'
  console.log(`
────────────────────────────────────────────
Compte démo prêt.
  Connexion : ${site}/login
  Email     : ${EMAIL}
  Portail client (Villa)    : ${site}/portail/${C.villa.id}
  Portail client (Immeuble) : ${site}/portail/${C.immeuble.id}

À faire EN DIRECT pendant la démo :
  • Pointage de la Villa aujourd'hui (laissé vide exprès)
  • Relance J+15 de FAC-007 (Immeuble, 22 jours de retard)
  • Relance de DEV-005 (Duplex Sotuba, sans réponse depuis 19 jours)
  • Valider la paie du mois en cours
────────────────────────────────────────────
`)
}

main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
