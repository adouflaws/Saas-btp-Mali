import {
  STATUTS_DEVIS,
  STATUTS_FACTURE,
  STATUTS_CHANTIER,
  STATUTS_TACHE,
  type StatutType,
  type StatutColor,
  type StatutDef,
} from '@/constants/statuts'

const TABLES: Record<StatutType, Record<string, StatutDef>> = {
  devis: STATUTS_DEVIS,
  facture: STATUTS_FACTURE,
  chantier: STATUTS_CHANTIER,
  tache: STATUTS_TACHE,
}

const CLASSES_DARK: Record<StatutColor, string> = {
  gray:       'bg-gray-500/10 text-gray-400',
  'gray-dark': 'bg-gray-700/30 text-gray-500',
  blue:       'bg-blue-500/10 text-blue-400',
  green:      'bg-emerald-500/10 text-emerald-400',
  purple:     'bg-purple-500/10 text-purple-400',
  red:        'bg-red-500/10 text-red-400',
  orange:     'bg-amber-500/10 text-amber-400',
}

const CLASSES_LIGHT: Record<StatutColor, string> = {
  gray:       'bg-gray-50 text-gray-600 border border-gray-100',
  'gray-dark': 'bg-gray-100 text-gray-600 border border-gray-200',
  blue:       'bg-blue-50 text-blue-600 border border-blue-100',
  green:      'bg-emerald-50 text-emerald-600 border border-emerald-100',
  purple:     'bg-purple-50 text-purple-600 border border-purple-100',
  red:        'bg-red-50 text-red-600 border border-red-100',
  orange:     'bg-amber-50 text-amber-600 border border-amber-100',
}

const BAR_CLASSES: Record<StatutColor, string> = {
  gray:       'bg-gray-400',
  'gray-dark': 'bg-gray-600',
  blue:       'bg-blue-400',
  green:      'bg-emerald-500',
  purple:     'bg-purple-400',
  red:        'bg-red-400',
  orange:     'bg-amber-500',
}

type Props = {
  type: StatutType
  statut: string | null | undefined
  theme?: 'dark' | 'light'
  className?: string
}

export default function StatusBadge({ type, statut, theme = 'dark', className = '' }: Props) {
  const table = TABLES[type]
  const def = statut ? table[statut] : undefined
  const label = def?.label ?? statut ?? '—'
  const color: StatutColor = def?.color ?? 'gray'
  const classes = theme === 'light' ? CLASSES_LIGHT[color] : CLASSES_DARK[color]

  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${classes} ${className}`}>
      {label}
    </span>
  )
}

export function statutBarClass(type: StatutType, statut: string | null | undefined): string {
  const table = TABLES[type]
  const def = statut ? table[statut] : undefined
  const color: StatutColor = def?.color ?? 'gray'
  return BAR_CLASSES[color]
}

// Pour les cas où le rendu du badge doit être composé avec du texte custom
// (ex: "3 en cours") plutôt que le libellé canonique seul.
export function statutBadgeClasses(type: StatutType, statut: string | null | undefined, theme: 'dark' | 'light' = 'dark'): string {
  const table = TABLES[type]
  const def = statut ? table[statut] : undefined
  const color: StatutColor = def?.color ?? 'gray'
  return theme === 'light' ? CLASSES_LIGHT[color] : CLASSES_DARK[color]
}
