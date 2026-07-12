export default function PageSkeleton() {
  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-5 animate-pulse">
      <div className="h-8 bg-white/[0.05] rounded-xl w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-white/[0.05] rounded-2xl" />
        ))}
      </div>
      <div className="h-10 bg-white/[0.05] rounded-xl" />
      <div className="h-64 bg-white/[0.05] rounded-2xl" />
    </div>
  )
}
