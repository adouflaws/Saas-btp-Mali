export default function StatCard({ label, value, sub }: {
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div className="bg-[#232323] rounded-xl p-4 border border-white/5">
      <p className="text-xs text-gray-400 mb-1 truncate">{label}</p>
      <p className="text-xl font-bold text-white leading-none truncate">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1 truncate">{sub}</p>}
    </div>
  )
}
