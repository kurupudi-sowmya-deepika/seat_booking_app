import React, { useEffect } from 'react';
import { MapPin, Building2, ArrowRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from '../context/LocationContext';

export const LocationSelectionModal: React.FC = () => {
  const {
    showSelectionModal,
    selectedLocation,
    selectedOffice,
    setSelectedLocation,
    setSelectedOffice,
    locations,
    offices,
    fetchLocations,
    fetchOffices,
    setShowSelectionModal,
    hasSelection,
  } = useLocation();

  useEffect(() => {
    if (showSelectionModal) fetchLocations();
  }, [showSelectionModal, fetchLocations]);

  useEffect(() => {
    if (selectedLocation) fetchOffices(selectedLocation);
  }, [selectedLocation, fetchOffices]);

  const handleContinue = () => {
    if (selectedLocation && selectedOffice) setShowSelectionModal(false);
  };

  return (
    <AnimatePresence>
      {showSelectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl relative"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-[#007bc0] to-[#0099e6] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Sparkles size={32} className="text-white" />
              </div>
              <h2 className="text-[28px] font-black text-gray-900 mb-2">Welcome to SpaceHub</h2>
              <p className="text-[15px] text-gray-500">Select your location and office to continue.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-[13px] font-bold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <MapPin size={14} />
                  Location
                </label>
                <select
                  value={selectedLocation || ''}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[15px] font-semibold outline-none focus:ring-2 focus:ring-[#007bc0]/30 focus:border-[#007bc0]"
                >
                  <option value="">Select Location</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.city})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-bold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Building2 size={14} />
                  Office
                </label>
                <select
                  value={selectedOffice || ''}
                  onChange={(e) => setSelectedOffice(e.target.value)}
                  disabled={!selectedLocation}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[15px] font-semibold outline-none focus:ring-2 focus:ring-[#007bc0]/30 focus:border-[#007bc0] disabled:opacity-50"
                >
                  <option value="">Select Office</option>
                  {offices.map((office) => (
                    <option key={office.id} value={office.id}>
                      {office.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleContinue}
              disabled={!hasSelection}
              className="w-full py-4 bg-[#007bc0] hover:bg-[#005a8c] text-white font-bold text-[16px] rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Continue</span>
              <ArrowRight size={18} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default LocationSelectionModal;
