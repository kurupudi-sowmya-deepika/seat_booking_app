import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

interface LocationContextType {
  selectedLocation: string | null;
  selectedOffice: string | null;
  setSelectedLocation: (locationId: string) => void;
  setSelectedOffice: (officeId: string) => void;
  hasSelection: boolean;
  showSelectionModal: boolean;
  setShowSelectionModal: (show: boolean) => void;
  locations: any[];
  offices: any[];
  fetchLocations: () => Promise<void>;
  fetchOffices: (locationId: string) => Promise<void>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [selectedLocation, setSelectedLocationState] = useState<string | null>(() => localStorage.getItem('selectedLocation'));
  const [selectedOffice, setSelectedOfficeState] = useState<string | null>(() => localStorage.getItem('selectedOffice'));
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);

  const hasSelection = !!(selectedLocation && selectedOffice);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await api.get('/locations/');
      setLocations(res.data || []);
    } catch (error) {
      console.error('Failed to fetch locations', error);
    }
  }, []);

  const fetchOffices = useCallback(async (locationId: string) => {
    try {
      const res = await api.get('/branches/', { params: { location_id: locationId } });
      const filtered = (res.data || []).filter((b: any) => b.location_id === locationId);
      setOffices(filtered);
    } catch (error) {
      console.error('Failed to fetch offices', error);
    }
  }, []);

  const setSelectedLocation = (locationId: string) => {
    setSelectedLocationState(locationId);
    localStorage.setItem('selectedLocation', locationId);
    setSelectedOfficeState(null);
    localStorage.removeItem('selectedOffice');
  };

  const setSelectedOffice = (officeId: string) => {
    setSelectedOfficeState(officeId);
    localStorage.setItem('selectedOffice', officeId);
  };

  useEffect(() => {
    if (!user) {
      setShowSelectionModal(false);
      return;
    }
    fetchLocations();
    if (selectedLocation) fetchOffices(selectedLocation);
    setShowSelectionModal(!hasSelection);
  }, [user, hasSelection, selectedLocation, fetchLocations, fetchOffices]);

  return (
    <LocationContext.Provider
      value={{
        selectedLocation,
        selectedOffice,
        setSelectedLocation,
        setSelectedOffice,
        hasSelection,
        showSelectionModal,
        setShowSelectionModal,
        locations,
        offices,
        fetchLocations,
        fetchOffices,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
