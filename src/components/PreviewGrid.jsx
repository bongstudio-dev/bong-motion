function PreviewGrid({ items, onRemove }) {
  return (
    <section className="rounded-[32px] border border-stroke bg-panel/70 p-5 shadow-glow backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-[0.28em] text-muted">
            Preview Grid
          </h2>
          <p className="mt-2 text-sm text-muted">
            Validación rápida del orden antes de conectar el sistema de
            partículas.
          </p>
        </div>
        <div className="rounded-full border border-white/10 px-3 py-1 font-mono text-xs text-muted">
          {items.length} páginas
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {items.map((item, index) => (
          <article
            key={item.id}
            className="group relative overflow-hidden rounded-[22px] border border-white/10 bg-black/20"
          >
            <button
              type="button"
              onClick={() => onRemove?.(item.id)}
              aria-label={`Eliminar ${item.file.name}`}
              className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-app/80 text-white opacity-0 backdrop-blur transition hover:bg-red-500 focus:opacity-100 group-hover:opacity-100"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
            <div className="aspect-video bg-black/20">
              <img
                src={item.url}
                alt={item.file.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="font-mono text-xs text-accent">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="truncate text-xs text-muted">
                {item.file.name}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default PreviewGrid;
