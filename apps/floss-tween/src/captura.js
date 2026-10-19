// setPointerCapture puede tirar (puntero ya soltado, eventos sintéticos): el gesto tiene que
// seguir funcionando dentro del elemento aunque no haya captura.
export function capturar(el, pointerId) {
  try { el.setPointerCapture(pointerId); } catch { /* sin capture */ }
}
