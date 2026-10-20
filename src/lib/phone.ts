// Format international requis par wa.me (ex: 22370000000) — enlève espaces/+/tirets,
// et préfixe le code pays 223 si le numéro a été saisi en local sur 8 chiffres.
export function formatWhatsAppTel(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '').replace(/^00/, '')
  if (!digits) return null
  return digits.length === 8 ? `223${digits}` : digits
}
