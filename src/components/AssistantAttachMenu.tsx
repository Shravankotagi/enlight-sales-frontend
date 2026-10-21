import { useState } from 'react';
import { Paperclip } from 'lucide-react';
import VisitCameraCapture from './VisitCameraCapture';

interface GpsReading {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface AssistantAttachMenuProps {
  disabled?: boolean;
  onUpload: () => void;
  readGps: () => Promise<GpsReading | null>;
  onCapture: (photoUrl: string, coords: GpsReading) => void;
}

export default function AssistantAttachMenu({
  disabled,
  onUpload,
  readGps,
  onCapture,
}: AssistantAttachMenuProps) {
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-200/60 rounded-lg transition-all"
        aria-label="Attach a file or take a photo"
      >
        <Paperclip size={18} />
      </button>
      {open && (
        <div className="absolute bottom-12 left-0 z-20 w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setCapturing(false);
              onUpload();
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
          >
            Upload from device
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setCapturing(true);
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
          >
            Capture an image
          </button>
        </div>
      )}
      {capturing && (
        <VisitCameraCapture
          autoStart
          disabled={disabled}
          readGps={readGps}
          onClose={() => setCapturing(false)}
          onCapture={(photoUrl, coords) => {
            onCapture(photoUrl, coords);
            setCapturing(false);
          }}
        />
      )}
    </div>
  );
}
