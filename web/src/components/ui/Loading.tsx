export function Loading() {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skeleton h-12 w-full" />
      ))}
    </div>
  )
}

export function PageLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="skeleton h-8 w-64" />
      <div className="skeleton h-4 w-96" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="stat-card space-y-3">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-8 w-32" />
          </div>
        ))}
      </div>
      <div className="card p-6 space-y-4">
        <div className="skeleton h-5 w-48" />
        <div className="skeleton h-[300px] w-full" />
      </div>
    </div>
  )
}
