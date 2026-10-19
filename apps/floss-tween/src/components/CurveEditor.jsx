import { useRef } from 'react';
import { capturar } from '../captura.js';
import { ScrubField } from '@bong/ui';

// Editor de curva cubic-bezier(x1, y1, x2, y2), igual que CSS. Los dos manejadores se
// arrastran en el cuadrado; los cuatro números se pueden afinar abajo.
export const PRESETS = [
  { id: 'empuje', nombre: 'Empuje', curva: [1, 0, 0, 1], nota: 'La de After: la cámara salta en el medio' },
  { id: 'ios', nombre: 'iOS', curva: [0.32, 0.72, 0, 1] },
  { id: 'suave', nombre: 'Suave', curva: [0.65, 0, 0.35, 1] },
  { id: 'ease', nombre: 'Ease', curva: [0.25, 0.1, 0.25, 1] },
  { id: 'lineal', nombre: 'Lineal', curva: [0, 0, 1, 1] },
];

const S = 200, PAD = 22, Y_MIN = -0.6, Y_MAX = 1.6;
const px = (x) => PAD + x * (S - 2 * PAD);
// El cuadrado de dibujo cubre y de Y_MIN a Y_MAX; 0 y 1 caen dentro, con aire para pasarse.
const yPx = (y) => PAD + (1 - (y - Y_MIN) / (Y_MAX - Y_MIN)) * (S - 2 * PAD);
const xDe = (p) => (p - PAD) / (S - 2 * PAD);
const yDe = (p) => Y_MIN + (1 - (p - PAD) / (S - 2 * PAD)) * (Y_MAX - Y_MIN);
const r2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export default function CurveEditor({ curva, onChange, titulo }) {
  const svg = useRef(null);
  const [x1, y1, x2, y2] = curva;

  const arrastrar = (cual) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = svg.current;
    capturar(el, e.pointerId);
    const rect = el.getBoundingClientRect();
    const mover = (ev) => {
      const sx = ((ev.clientX - rect.left) / rect.width) * S;
      const sy = ((ev.clientY - rect.top) / rect.height) * S;
      const x = r2(clamp(xDe(sx), 0, 1)), y = r2(clamp(yDe(sy), Y_MIN, Y_MAX));
      onChange(cual === 1 ? [x, y, x2, y2] : [x1, y1, x, y]);
    };
    const soltar = () => {
      el.removeEventListener('pointermove', mover);
      el.removeEventListener('pointerup', soltar);
      el.removeEventListener('pointercancel', soltar);
    };
    el.addEventListener('pointermove', mover);
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
  };

  const preset = PRESETS.find((p) => p.curva.every((v, i) => Math.abs(v - curva[i]) < 0.005));
  const set = (i) => (v) => onChange(curva.map((c, j) => (j === i ? v : c)));

  return (
    <div className="ft-curva">
      {titulo && <div className="ft-sub">{titulo}</div>}
      <div className="ft-presets" role="group" aria-label="Curvas predefinidas">
        {PRESETS.map((p) => (
          <button key={p.id} className={`ft-chip ${preset?.id === p.id ? 'on' : ''}`} onClick={() => onChange([...p.curva])} title={p.nota}>
            {p.nombre}
          </button>
        ))}
      </div>
      <svg ref={svg} className="ft-curva-svg" viewBox={`0 0 ${S} ${S}`} aria-label="Editor de curva">
        <rect x={px(0)} y={yPx(1)} width={px(1) - px(0)} height={yPx(0) - yPx(1)} className="ft-curva-caja" />
        <line x1={px(0)} y1={yPx(0)} x2={px(1)} y2={yPx(1)} className="ft-curva-diag" />
        <line x1={px(0)} y1={yPx(0)} x2={px(x1)} y2={yPx(y1)} className="ft-curva-brazo" />
        <line x1={px(1)} y1={yPx(1)} x2={px(x2)} y2={yPx(y2)} className="ft-curva-brazo" />
        <path className="ft-curva-trazo" d={`M${px(0)} ${yPx(0)}C${px(x1)} ${yPx(y1)} ${px(x2)} ${yPx(y2)} ${px(1)} ${yPx(1)}`} />
        {[[1, x1, y1], [2, x2, y2]].map(([n, x, y]) => (
          <g key={n} onPointerDown={arrastrar(n)} className="ft-curva-mango">
            <circle cx={px(x)} cy={yPx(y)} r="22" fill="transparent" />
            <circle cx={px(x)} cy={yPx(y)} r="7" />
          </g>
        ))}
      </svg>
      <div className="ft-curva-nums">
        <ScrubField label="x1" value={x1} min={0} max={1} step={0.01} onChange={set(0)} />
        <ScrubField label="y1" value={y1} min={Y_MIN} max={Y_MAX} step={0.01} onChange={set(1)} />
        <ScrubField label="x2" value={x2} min={0} max={1} step={0.01} onChange={set(2)} />
        <ScrubField label="y2" value={y2} min={Y_MIN} max={Y_MAX} step={0.01} onChange={set(3)} />
      </div>
    </div>
  );
}
