export interface GpsReading {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export const ADDRESS_TARGET_METERS = 20;
export const ADDRESS_WATCH_MS = 15000;
export const PHOTO_GPS_WAIT_MS = 3000;

interface GpsPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
}

export interface VisitGpsSource {
  watchPosition: (
    success: (position: GpsPosition) => void,
    error?: (error: unknown) => void,
    options?: PositionOptions,
  ) => number;
  clearWatch: (id: number) => void;
}

export interface VisitGpsSession {
  watchForAddress: () => Promise<GpsReading | null>;
  readForPhoto: () => Promise<GpsReading | null>;
}

function readingFrom(position: GpsPosition): GpsReading {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: Math.round(position.coords.accuracy),
  };
}

export function createVisitGpsSession(source?: VisitGpsSource | null): VisitGpsSession {
  const geo = source === undefined ? navigator.geolocation : source;
  let best: GpsReading | null = null;
  let addressPromise: Promise<GpsReading | null> | null = null;
  const waiters: Array<(reading: GpsReading | null) => void> = [];

  const publish = (reading: GpsReading) => {
    if (!best || reading.accuracy < best.accuracy) best = reading;
    const pending = waiters.splice(0);
    pending.forEach((notify) => notify(best));
  };

  const watchForAddress = () => {
    if (addressPromise) return addressPromise;
    if (!geo) return Promise.resolve(null);
    let resolveAddress: (reading: GpsReading | null) => void = () => undefined;
    const current = new Promise<GpsReading | null>((resolve) => {
      resolveAddress = resolve;
    });
    addressPromise = current;
    let settled = false;
    let watchId = 0;
    let timer = 0;
    const finish = (reading: GpsReading | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (watchId) geo.clearWatch(watchId);
      if (addressPromise === current) addressPromise = null;
      if (!reading) {
        const pending = waiters.splice(0);
        pending.forEach((notify) => notify(null));
      }
      resolveAddress(reading);
    };
    timer = window.setTimeout(() => finish(best), ADDRESS_WATCH_MS);
    watchId = geo.watchPosition(
      (position) => {
        const reading = readingFrom(position);
        publish(reading);
        if (reading.accuracy <= ADDRESS_TARGET_METERS) finish(best);
      },
      (error) => {
        console.warn('Geolocation capture failed or denied:', error);
        finish(best);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: ADDRESS_WATCH_MS },
    );
    return current;
  };

  const readForPhoto = () => {
    if (best) return Promise.resolve(best);
    if (!addressPromise) return Promise.resolve(null);
    return new Promise<GpsReading | null>((resolve) => {
      let settled = false;
      const done = (reading: GpsReading | null) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(reading);
      };
      const timer = window.setTimeout(() => {
        const index = waiters.indexOf(done);
        if (index >= 0) waiters.splice(index, 1);
        done(best);
      }, PHOTO_GPS_WAIT_MS);
      waiters.push(done);
    });
  };

  return { watchForAddress, readForPhoto };
}
