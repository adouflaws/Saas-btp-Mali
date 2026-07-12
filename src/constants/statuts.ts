export type StatutColor = 'gray' | 'gray-dark' | 'blue' | 'green' | 'purple' | 'red' | 'orange'

export type StatutDef = { label: string; color: StatutColor }

export const STATUTS_DEVIS = {
  brouillon: { label: 'Brouillon', color: 'gray' },
  envoye:    { label: 'Envoyé', color: 'blue' },
  accepte:   { label: 'Accepté', color: 'green' },
  converti:  { label: 'Converti', color: 'purple' },
  refuse:    { label: 'Refusé', color: 'red' },
  expire:    { label: 'Expiré', color: 'gray-dark' },
} as const satisfies Record<string, StatutDef>

export const STATUTS_FACTURE = {
  en_attente:         { label: 'En attente', color: 'orange' },
  partiellement_paye: { label: 'Partiellement payée', color: 'blue' },
  paye:               { label: 'Payée', color: 'green' },
  en_retard:          { label: 'En retard', color: 'red' },
} as const satisfies Record<string, StatutDef>

export const STATUTS_CHANTIER = {
  preparation: { label: 'En préparation', color: 'gray' },
  en_cours:    { label: 'En cours', color: 'blue' },
  en_pause:    { label: 'Suspendu', color: 'orange' },
  termine:     { label: 'Terminé', color: 'green' },
  annule:      { label: 'Annulé', color: 'red' },
} as const satisfies Record<string, StatutDef>

export const STATUTS_TACHE = {
  a_faire:  { label: 'À faire', color: 'gray' },
  en_cours: { label: 'En cours', color: 'blue' },
  termine:  { label: 'Terminée', color: 'green' },
  bloque:   { label: 'Bloquée', color: 'red' },
} as const satisfies Record<string, StatutDef>

export type StatutType = 'devis' | 'facture' | 'chantier' | 'tache'

export type DevisStatutKey = keyof typeof STATUTS_DEVIS
export type FactureStatutKey = keyof typeof STATUTS_FACTURE
export type ChantierStatutKey = keyof typeof STATUTS_CHANTIER
export type TacheStatutKey = keyof typeof STATUTS_TACHE
