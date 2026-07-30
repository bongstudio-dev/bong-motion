import { TOOLS, toolHref } from "./tools.js";

// Isotipo de Bong. Va con currentColor para que tome el verde del tema y no
// arrastre un hex propio.
export function BongMark({ size = 19 }) {
  return (
    <svg
      viewBox="0 0 218 256"
      width={(size * 218) / 256}
      height={size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M193.605 17.9034C204.496 28.8698 211.483 44.1209 211.483 60.851C211.483 77.5812 204.496 92.7812 193.605 103.799C182.56 114.969 167.405 121.702 150.555 121.702C133.704 121.702 118.549 114.918 107.658 103.799C96.7672 92.8323 89.7806 77.5812 89.7806 60.851C89.7806 44.1209 96.7672 28.9209 107.658 17.9034C118.549 6.73288 133.858 0 150.555 0C167.251 0 182.56 6.78388 193.605 17.9034Z" />
      <path d="M73.0789 18.6733C75.7969 25.7411 75.7969 34.1817 73.0789 41.4022C70.5148 47.809 65.9504 53.1987 59.1298 56.046C93.9512 62.0971 91.9512 119.707 52.8219 119.707H0V1.99536H48.104C61.0273 1.99536 69.3352 9.21569 73.0789 18.6733Z" />
      <path d="M0 133.673L0.102501 253.38H44.8445H83.7949V135.199H44.8445V185.106L1.99878 133.673H0Z" />
      <path d="M153.414 194.879L184.78 140.586C176.341 136.164 166.784 133.673 156.616 133.673C123.013 133.673 95.7653 160.921 95.7653 194.524C95.7653 228.127 123.013 255.375 156.616 255.375C190.219 255.375 217.315 228.33 217.467 194.829H153.414V194.879Z" />
    </svg>
  );
}

// Los tres motores son apps distintas: cambiar de tool recarga. La sidebar es
// lo que hace que se sientan una sola plataforma igual.
const GLYPHS = {
  "plane-animator": (
    <svg viewBox="0 0 22 22" width="19" height="19" aria-hidden="true">
      <rect x="1.5" y="6" width="4.5" height="10" rx="1" fill="currentColor" opacity=".4" />
      <rect x="7.5" y="3.5" width="7" height="15" rx="1.2" fill="currentColor" />
      <rect x="16" y="6" width="4.5" height="10" rx="1" fill="currentColor" opacity=".4" />
    </svg>
  ),
  "palette-animator": (
    <svg viewBox="0 0 22 22" width="19" height="19" aria-hidden="true">
      <rect x="2" y="4" width="4" height="14" rx="1" fill="currentColor" opacity=".35" />
      <rect x="7" y="4" width="4" height="14" rx="1" fill="currentColor" opacity=".6" />
      <rect x="12" y="4" width="4" height="14" rx="1" fill="currentColor" opacity=".85" />
      <rect x="17" y="4" width="3" height="14" rx="1" fill="currentColor" />
    </svg>
  ),
  "particle-visualizer": (
    <svg viewBox="0 0 22 22" width="19" height="19" aria-hidden="true">
      <circle cx="5" cy="7" r="1.6" fill="currentColor" opacity=".55" />
      <circle cx="11" cy="4.5" r="1.2" fill="currentColor" opacity=".4" />
      <circle cx="16.5" cy="8" r="2.1" fill="currentColor" />
      <circle cx="6.5" cy="14.5" r="2.1" fill="currentColor" opacity=".8" />
      <circle cx="13" cy="12" r="1.3" fill="currentColor" opacity=".5" />
      <circle cx="17" cy="16" r="1.5" fill="currentColor" opacity=".65" />
    </svg>
  ),
};

export function ToolSidebar({ current, isDev = false }) {
  return (
    <nav className="tool-rail" aria-label="Herramientas">
      <a className="tool-rail-mark" href="../" title="Bong Motion">
        <BongMark />
      </a>

      {TOOLS.map((tool) => {
        const active = tool.id === current;
        return (
          <a
            key={tool.id}
            className={`tool-rail-item ${active ? "active" : ""}`}
            href={active ? undefined : toolHref(tool, isDev)}
            title={tool.title}
            aria-current={active ? "page" : undefined}
          >
            {GLYPHS[tool.id]}
            <span>{tool.name}</span>
          </a>
        );
      })}
    </nav>
  );
}

export default ToolSidebar;
