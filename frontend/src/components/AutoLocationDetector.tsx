import React, { useState } from 'react';
import api from '../services/api';
import { Navigation, Loader2, AlertCircle, CheckCircle2, MapPin } from 'lucide-react';

interface AutoLocationDetectorProps {
  onLocationDetected: (locationId: string, branchId?: string) => void;
  selectedLocationId?: string;
}

export const AutoLocationDetector: React.FC<AutoLocationDetectorProps> = ({
  onLocationDetected,
  selectedLocationId
}) => {
  const [detecting, setDetecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setStatusMessage({
        type: 'error',
        text: "Geolocation is not supported by your browser. Please select a location manually."
      });
      return;
    }

    setDetecting(true);
    setStatusMessage(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await api.get('/locations/nearest', {
            params: { latitude, longitude }
          });

          if (res.data?.location) {
            const loc = res.data.location;
            const branch = res.data.suggested_branch;
            const dist = res.data.distance_km;

            onLocationDetected(loc.id, branch?.id);
            setStatusMessage({
              type: 'success',
              text: `Detected nearest office: ${loc.name} (${loc.city}) ~ ${dist} km away`
            });
          }
        } catch (err: any) {
          setStatusMessage({
            type: 'error',
            text: err.response?.data?.detail || "We couldn't detect your nearest location. Please select a location manually."
          });
        } finally {
          setDetecting(false);
        }
      },
      (error) => {
        setDetecting(false);
        let msg = "We couldn't detect your location. Please select a location manually.";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "Location permission was denied. Please select a location manually.";
        }
        setStatusMessage({ type: 'error', text: msg });
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="bg-gradient-to-r from-sky-50 to-blue-50 border border-blue-100 rounded-xl p-4 mb-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#007bc0]/10 text-[#007bc0] flex items-center justify-center shrink-0">
            <MapPin size={22} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-800">Auto-Detect Office Location</h4>
            <p className="text-xs text-gray-500">Quickly locate the closest workspace branch to your current location</p>
          </div>
        </div>

        <button
          type="button"
          onClick={detectLocation}
          disabled={detecting}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#007bc0] hover:bg-[#005691] text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-60 whitespace-nowrap"
        >
          {detecting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Locating...</span>
            </>
          ) : (
            <>
              <Navigation size={14} />
              <span>Use My Current Location</span>
            </>
          )}
        </button>
      </div>

      {statusMessage && (
        <div
          className={`mt-3 text-xs flex items-center gap-2 p-2.5 rounded-lg ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-amber-50 text-amber-800 border border-amber-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-amber-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
};

export default AutoLocationDetector;
