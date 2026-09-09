import React, { useState } from 'react';
import { MapPin, Building, Grid, Settings2, ShieldCheck } from 'lucide-react';

const AdminSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('locations');

  const tabs = [
    { id: 'locations', label: 'Locations', icon: <MapPin size={18} /> },
    { id: 'branches', label: 'Branches', icon: <Building size={18} /> },
    { id: 'rooms', label: 'Meeting Rooms', icon: <Grid size={18} /> },
    { id: 'general', label: 'General Settings', icon: <Settings2 size={18} /> },
    { id: 'security', label: 'Security & Access', icon: <ShieldCheck size={18} /> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">System Settings</h1>
        <p className="text-[var(--text-secondary)]">Configure core infrastructure, branches, and application settings.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 mt-8">
        {/* Settings Sidebar */}
        <div className="w-full md:w-64 space-y-1 shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id 
                  ? 'bg-[var(--primary-color)] text-white shadow-md' 
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-color-light)] hover:text-[var(--primary-color)]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Settings Content Area */}
        <div className="flex-1 glass-panel p-8 min-h-[500px]">
          {activeTab === 'locations' && (
            <div className="animate-fade-in space-y-6">
              <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-4">
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">Manage Office Locations</h2>
                <button className="btn btn-primary text-sm py-1.5 px-4">+ Add Location</button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['Bangalore (BLR)', 'Hyderabad (HYD)', 'Pune (PUN)'].map((loc, idx) => (
                  <div key={idx} className="border border-[var(--border-color)] rounded-lg p-4 flex justify-between items-center bg-[var(--surface-color-light)]">
                    <div>
                      <h4 className="font-medium text-[var(--text-primary)]">{loc}</h4>
                      <p className="text-xs text-[var(--text-secondary)]">{idx === 0 ? 'Primary Headquarters' : 'Regional Office'}</p>
                    </div>
                    <button className="text-[var(--primary-color)] text-sm hover:underline">Edit</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab !== 'locations' && (
            <div className="animate-fade-in flex flex-col items-center justify-center h-full text-center text-[var(--text-muted)] py-20">
              <Settings2 size={48} className="mb-4 opacity-20" />
              <h3 className="text-lg font-medium text-[var(--text-secondary)] mb-2">Configuration Panel</h3>
              <p className="max-w-md text-sm">Select a specific entity to configure or edit. Data management features will be fully functional when wired to backend APIs.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
