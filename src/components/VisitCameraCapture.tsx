import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera } from 'lucide-react';
import { visitPhotoStampLabel } from '../utils/visitForm';

interface GpsReading {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface VisitCameraCaptureProps {
  disabled?: boolean;
  autoStart?: boolean;
  readGps: () => Promise<GpsReading | null>;
  onCapture: (photoUrl: string, coords: GpsReading) => void;
  onClose?: () => void;
}

const NO_CAMERA = 'This device has no camera. A visit photo cannot be taken here.';
const NO_GPS = 'This photo has no GPS data. Allow location and take it again.';

export default function VisitCameraCapture({
  disabled,
  autoStart = false,
  readGps,
  onCapture,
  onClose,
}: VisitCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const stop = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const close = () => {
    setOpen(false);
    stop();
    onClose?.();
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(NO_CAMERA);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setOpen(true);
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      }, 0);
    } catch {
      setError(NO_CAMERA);
      stop();
    }
  };

  useEffect(() => {
    if (autoStart) void start();
    // Start once when the assistant opens the camera. `start` closes over the latest refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError(NO_CAMERA);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const coords = await readGps();
      if (!coords) {
        setError(NO_GPS);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        setError(NO_CAMERA);
        return;
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const label = visitPhotoStampLabel(
        coords.latitude,
        coords.longitude,
        new Date(),
      );
      context.fillStyle = 'rgba(15, 23, 42, 0.72)';
      context.fillRect(0, canvas.height - 40, canvas.width, 40);
      context.fillStyle = '#ffffff';
      context.font = '16px Arial';
      context.fillText(label, 12, canvas.height - 14);
      onCapture(canvas.toDataURL('image/jpeg', 0.85), coords);
      close();
    } finally {
      setBusy(false);
    }
  };

  const dialog = (open || (autoStart && error)) && (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4">
      <div
        role="dialog"
        aria-label="Visit camera"
        className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl"
      >
        {open && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-[70vh] w-full rounded-xl bg-slate-900 object-cover"
          />
        )}
        {error && (
          <p className="mt-2 text-sm font-semibold text-rose-600">{error}</p>
        )}
        <div className="mt-3 flex gap-2">
          {open && (
            <button
              type="button"
              onClick={capture}
              disabled={busy}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-60"
            >
              {busy ? 'Capturing...' : 'Capture photo'}
            </button>
          )}
          <button
            type="button"
            onClick={close}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      {!autoStart && (
        <button
          type="button"
          onClick={start}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-medium border border-blue-200 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
        >
          <Camera size={13} />
          Take visit photo
        </button>
      )}
      {error && !open && !autoStart && (
        <p className="text-[11px] font-semibold text-rose-600">{error}</p>
      )}
      {dialog && createPortal(dialog, document.body)}
    </div>
  );
}
