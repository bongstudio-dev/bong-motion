import { useEffect, useRef, useState } from "react";

function computeScale(node, stageWidth, stageHeight) {
  if (!node) {
    return 0.25;
  }

  const bounds = node.getBoundingClientRect();
  const availableWidth = Math.max(bounds.width - 24, 240);
  // En layout de una sola columna el stage queda sticky arriba: lo limitamos a
  // ~la mitad del alto para que los controles de abajo sigan siendo usables.
  const isSingleColumn = window.innerWidth < 1280;
  const heightBudget = isSingleColumn
    ? Math.round(window.innerHeight * 0.5)
    : window.innerHeight - 220;
  const availableHeight = Math.max(heightBudget, isSingleColumn ? 240 : 320);
  const widthScale = availableWidth / stageWidth;
  const heightScale = availableHeight / stageHeight;

  return Math.min(widthScale, heightScale, 1);
}

export function useStageScale(stageWidth, stageHeight) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0.25);

  useEffect(() => {
    const updateScale = () => {
      setScale(computeScale(containerRef.current, stageWidth, stageHeight));
    };

    updateScale();

    const resizeObserver = new ResizeObserver(updateScale);

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener("resize", updateScale);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [stageWidth, stageHeight]);

  return {
    containerRef,
    scale,
    width: stageWidth,
    height: stageHeight,
  };
}
