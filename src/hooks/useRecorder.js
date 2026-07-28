import { useCallback, useEffect, useRef, useState } from "react";

// Preferimos MP4 (H.264); caemos a WebM si el navegador no lo soporta en grabación.
const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4;codecs=h264",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

function pickMime() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }
  return (
    MIME_CANDIDATES.find((type) => {
      try {
        return MediaRecorder.isTypeSupported(type);
      } catch {
        return false;
      }
    }) || ""
  );
}

export function useRecorder(canvasRef, fps = 60) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [mime] = useState(pickMime);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const start = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mime || recorderRef.current) {
      return;
    }

    const stream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 12_000_000,
    });

    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      const ext = mime.includes("mp4") ? "mp4" : "webm";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const stamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      anchor.href = url;
      anchor.download = `particles-${stamp}.${ext}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      window.clearInterval(timerRef.current);
      recorderRef.current = null;
      setIsRecording(false);
    };

    recorder.start();
    recorderRef.current = recorder;
    setSeconds(0);
    setIsRecording(true);
    timerRef.current = window.setInterval(() => {
      setSeconds((current) => current + 1);
    }, 1000);
  }, [canvasRef, fps, mime]);

  useEffect(() => {
    return () => {
      window.clearInterval(timerRef.current);
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
    };
  }, []);

  const format = mime.includes("mp4")
    ? "MP4"
    : mime.includes("webm")
      ? "WebM"
      : "N/D";

  return {
    isRecording,
    seconds,
    start,
    stop,
    format,
    supported: Boolean(mime),
  };
}
