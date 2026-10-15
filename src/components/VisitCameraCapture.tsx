import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { visitPhotoStampLabel } from '../utils/visitForm';

interface GpsReading {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface VisitCameraCaptureProps {
  disabled?: boolean;
  readGps: () => Promise<GpsReading | null>;
  onCapture: (photoUrl: string, coords: GpsReading) => void;
}

const NO_CAMERA = 'This device has no camera. A visit photo cannot be taken here.';
const NO_GPS = 'This photo has no GPS data. Allow location and take it again.';

export default function VisitCameraCapture({
  disabled,
  readGps,
  onCapture,
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
      setOpen(false);
      stop();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={start}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-medium border border-blue-200 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
      >
        <Camera size={13} />
        Take visit photo
      </button>
      {error && (
        <p className="text-[11px] font-semibold text-rose-600">{error}</p>
      )}
      {open && (
        <div className="space-y-2">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full max-h-56 rounded-xl bg-slate-900"
          />
          <button
            type="button"
            onClick={capture}
            disabled={busy}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-[11px] font-bold cursor-pointer disabled:opacity-60"
          >
            {busy ? 'Capturing...' : 'Capture photo'}
          </button>
        </div>
      )}
    </div>
  );
}
