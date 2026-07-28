import { useCallback, useMemo, useRef, useState } from "react";

function Dropzone({ items, onReplace }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const helperText = useMemo(() => {
    if (!items.length) {
      return "JPG, PNG o WEBP. Se ordenan automáticamente con natural sort.";
    }

    return `${items.length} páginas listas para previsualizar en el stage.`;
  }, [items.length]);

  const handleFileSelection = useCallback(
    (event) => {
      const files = event.target.files;

      if (files?.length) {
        onReplace(files);
      }
    },
    [onReplace],
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      setIsDragging(false);

      if (event.dataTransfer.files?.length) {
        onReplace(event.dataTransfer.files);
      }
    },
    [onReplace],
  );

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-[0.28em] text-muted">
            Dropzone
          </h2>
          <p className="mt-2 text-sm text-muted">{helperText}</p>
        </div>
        {items.length ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-full border border-accent/20 bg-accent px-4 py-2 text-sm font-medium text-app transition hover:bg-[#3ce09b]"
          >
            Reemplazar
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        multiple
        className="hidden"
        onChange={handleFileSelection}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={() => setIsDragging(true)}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) {
            return;
          }
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        className={`group relative flex min-h-[240px] w-full flex-col items-center justify-center overflow-hidden rounded-[28px] border px-6 py-10 text-center transition ${
          isDragging
            ? "border-accent bg-accent/10 shadow-[0_0_0_1px_rgba(32,198,131,0.35)]"
            : "border-dashed border-stroke bg-black/10 hover:border-accent/40 hover:bg-white/[0.03]"
        }`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(32,198,131,0.12),transparent_48%)] opacity-80" />
        <div className="relative z-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-accent/20 bg-accent/10">
            <span className="font-mono text-xl text-accent">+</span>
          </div>
          <p className="mt-5 text-lg font-medium text-white">
            Arrastrá páginas del manual o hacé click para cargar
          </p>
          <p className="mt-2 font-mono text-xs uppercase tracking-[0.28em] text-muted">
            Multiple files enabled
          </p>
        </div>
      </button>
    </section>
  );
}

export default Dropzone;
