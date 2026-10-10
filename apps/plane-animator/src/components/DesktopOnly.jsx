// Plane Animator es una herramienta de escritorio: el stage WebGL, la columna
// de paneles y el export de video no entran ni rinden en un teléfono. En
// mobile no se monta la app (ni el renderer, ni el reloj, ni el localStorage):
// se muestra un cartel centrado y nada más.
//
// "Mobile" = pantalla táctil sin hover (teléfonos y tablets) o un user agent
// móvil. Una laptop con pantalla táctil sigue teniendo mouse, así que pasa.
function isMobile() {
  if (typeof window === "undefined") return false;
  const touchOnly = window.matchMedia?.("(hover: none) and (pointer: coarse)").matches;
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return Boolean(touchOnly || mobileUA);
}

const wrap = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "var(--bg)",
  color: "var(--text)",
  fontFamily: "var(--font)",
  textAlign: "center",
};

const card = {
  maxWidth: 320,
  padding: "28px 24px",
  borderRadius: "var(--radius)",
  border: "1px solid var(--stroke)",
  background: "var(--panel)",
};

export default function DesktopOnly({ children }) {
  if (!isMobile()) return children;
  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
          Plane Animator · Bong Studio
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.25 }}>
          Esta herramienta funciona solo en escritorio
        </div>
        <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 12, lineHeight: 1.45 }}>
          Abrila desde una computadora para usarla.
        </div>
      </div>
    </div>
  );
}
