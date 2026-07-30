import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Cámara + detección de la mano.
//
// Devuelve un `tracker` de identidad estable: un objeto mutable que el rAF de
// render lee en cada frame. La posición de la mano NO pasa por el state de
// React — a 30Hz serían 30 renders/s del árbol entero y el canvas se caería.
//
// `enabled` abre la cámara (alcanza para usar el video de fondo).
// `needsLandmarker` además baja el modelo. Están separados para no descargar
// 40MB si lo único que querés es el fondo.

const MODEL_URL = "./mediapipe/hand_landmarker.task";
const WASM_BASE = "./mediapipe/wasm";
const INDEX_FINGER_TIP = 8;
const MIN_INTERVAL_MS = 30; // techo de ~33fps de inferencia

// getUserMedia falla por motivos muy distintos y "error de cámara" no le sirve
// a nadie: cada uno se arregla de otra forma.
function describe(err) {
  switch (err?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Permiso denegado. Habilitalo en el candado de la barra de direcciones.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No se encontró ninguna cámara.";
    case "NotReadableError":
    case "TrackStartError":
      return "La cámara está en uso por otra aplicación (Zoom, Meet, OBS).";
    case "OverconstrainedError":
      return "La cámara no soporta la resolución pedida.";
    case "SecurityError":
      return "Se necesita HTTPS o localhost para usar la cámara.";
    default:
      return err?.message || "No se pudo iniciar la cámara.";
  }
}

export function useHandTracking({ enabled, needsLandmarker, onFail }) {
  const [status, setStatus] = useState("off"); // off | starting | loading-model | live | error
  const [error, setError] = useState(null);

  // Identidad estable para todo el ciclo de vida del componente.
  const tracker = useMemo(
    () => ({
      video: null,
      ready: false,
      hasHand: false,
      // Landmark CRUDO del frame, normalizado 0..1 y sin espejar. El recorte y
      // el espejo los aplica el render, que es el que conoce el stage actual.
      x: 0.5,
      y: 0.5,
      seq: 0,
      lastAt: 0,
      inferenceMs: 0,
    }),
    [],
  );

  const landmarkerRef = useRef(null);
  const failRef = useRef(onFail);
  failRef.current = onFail;

  // La cámara se suelta al ocultar la pestaña: dejar el LED prendido mientras
  // hacés otra cosa es feo, y el navegador congela los callbacks igual.
  const [visible, setVisible] = useState(
    typeof document === "undefined" ? true : !document.hidden,
  );
  useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  /* ---------- Modelo ---------- */

  useEffect(() => {
    if (!needsLandmarker) return undefined;
    let cancelled = false;

    (async () => {
      try {
        // Import dinámico: el bundle de MediaPipe no puede entrar al chunk
        // inicial de una tool que se abre para otras cosas.
        const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);

        const create = (delegate) =>
          HandLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate },
            runningMode: "VIDEO",
            // Con 2 manos el índice del array baila entre frames y el emisor
            // salta de un dedo al otro.
            numHands: 1,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });

        let landmarker;
        try {
          landmarker = await create("GPU");
        } catch {
          // Sin WebGL2, o con demasiados contextos GL vivos.
          landmarker = await create("CPU");
        }

        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
      } catch (err) {
        if (cancelled) return;
        setError(`No se pudo cargar el modelo: ${err?.message ?? err}`);
        setStatus("error");
        failRef.current?.();
      }
    })();

    return () => {
      cancelled = true;
      // close() libera el heap del WASM. Sin esto, cada ciclo on/off filtra
      // memoria y a las pocas veces el browser tira OOM.
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [needsLandmarker, attempt]);

  /* ---------- Cámara + loop de detección ---------- */

  const active = enabled && visible;

  useEffect(() => {
    if (!active) {
      // Un fallo apaga los toggles, y eso vuelve a correr este efecto con
      // active=false. Si acá se pisara el estado, el mensaje de error se
      // borraría en el mismo tick en que aparece y el usuario vería el toggle
      // saltar a off sin ninguna explicación.
      setStatus((s) => (s === "error" ? s : "off"));
      return undefined;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no expone la cámara (¿estás en HTTP y no en localhost?).");
      setStatus("error");
      failRef.current?.();
      return undefined;
    }

    let cancelled = false;
    let stream = null;
    let video = null;
    let rafHandle = 0;
    let pollTimer = 0;
    let lastRun = 0;
    let ts = 0;

    const teardown = () => {
      if (video && rafHandle) video.cancelVideoFrameCallback?.(rafHandle);
      if (pollTimer) clearInterval(pollTimer);
      // stop() sobre TODOS los tracks es lo único que apaga el LED.
      stream?.getTracks().forEach((t) => t.stop());
      if (video) {
        video.srcObject = null;
        video.remove();
      }
      tracker.video = null;
      tracker.ready = false;
      tracker.hasHand = false;
    };

    const fail = (err) => {
      teardown();
      setError(describe(err));
      setStatus("error");
      failRef.current?.();
    };

    const detect = (nowMs) => {
      const landmarker = landmarkerRef.current;
      if (!landmarker || !video || video.readyState < 2 || !video.videoWidth) return;
      if (nowMs - lastRun < MIN_INTERVAL_MS) return;
      lastRun = nowMs;

      // MediaPipe exige timestamps estrictamente crecientes y `mediaTime` se
      // repite cuando el mismo frame se entrega dos veces.
      ts = Math.max(ts + 1, Math.round(nowMs));

      const t0 = performance.now();
      let result;
      try {
        result = landmarker.detectForVideo(video, ts);
      } catch {
        return; // un frame fallido no justifica tirar la sesión
      }
      tracker.inferenceMs += (performance.now() - t0 - tracker.inferenceMs) * 0.1;

      const tip = result?.landmarks?.[0]?.[INDEX_FINGER_TIP];
      if (tip) {
        tracker.x = tip.x;
        tracker.y = tip.y;
        tracker.hasHand = true;
        tracker.lastAt = nowMs;
        tracker.seq++;
      } else {
        // Sin mano NO se tocan x/y: eso ES la retención de la última posición.
        tracker.hasHand = false;
      }
    };

    const onFrame = (nowMs) => {
      // Re-registrar SIEMPRE y primero. Si se sale antes por un return
      // temprano, el loop muere y la cámara queda prendida sin hacer nada.
      rafHandle = video.requestVideoFrameCallback(onFrame);
      detect(nowMs);
    };

    setStatus(needsLandmarker && !landmarkerRef.current ? "loading-model" : "starting");
    setError(null);

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            // 4:3 a propósito: con 16:9 en un stage 9:16 sobrevive el 32% del
            // encuadre y hay que sacar la mano casi de cuadro para llegar al
            // borde. Con 4:3 sube a 42%.
            width: { ideal: 1280 },
            height: { ideal: 960 },
            frameRate: { ideal: 30 },
          },
        });

        // StrictMode corre el efecto dos veces en dev: si el cleanup ya pasó
        // mientras esperábamos, este stream es huérfano y nadie lo va a apagar.
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        video = document.createElement("video");
        video.playsInline = true;
        video.muted = true;
        video.autoplay = true;
        // display:none suspende el pipeline de video en algunos browsers y
        // requestVideoFrameCallback deja de dispararse.
        video.style.cssText =
          "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none";
        document.body.appendChild(video);
        video.srcObject = stream;
        await video.play();

        if (cancelled) {
          teardown();
          return;
        }

        // Si desenchufan la webcam, avisar en vez de quedar mostrando el último
        // frame congelado para siempre.
        stream.getVideoTracks()[0].addEventListener("ended", () => {
          if (!cancelled) fail({ name: "NotReadableError" });
        });

        tracker.video = video;
        tracker.ready = true;
        setStatus("live");

        if (video.requestVideoFrameCallback) {
          rafHandle = video.requestVideoFrameCallback(onFrame);
        } else {
          // Firefox no soporta rVFC.
          let lastTime = -1;
          pollTimer = setInterval(() => {
            if (video.currentTime !== lastTime) {
              lastTime = video.currentTime;
              detect(performance.now());
            }
          }, 33);
        }
      } catch (err) {
        if (!cancelled) fail(err);
      }
    })();

    return () => {
      cancelled = true;
      teardown();
    };
  }, [active, needsLandmarker, attempt, tracker]);

  return { status, error, tracker, retry };
}

export default useHandTracking;
