import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  status?: string;
  auth_provider?: string;
  profile_photo?: string | null;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  profilePhoto: string | null;
  login: (token: string, user: User, photo?: string | null) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [profilePhoto, setProfilePhoto] = useState<string | null>(localStorage.getItem('user_photo'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (token) {
        try {
          const response = await api.get('/auth/me');
          setUser(response.data);
          const savedPhoto = localStorage.getItem('user_photo');
          if (savedPhoto) setProfilePhoto(savedPhoto);
        } catch (error) {
          console.error("Failed to fetch user", error);
          logout();
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, [token]);

  const login = (newToken: string, userData: User, photo?: string | null) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    if (photo) {
      localStorage.setItem('user_photo', photo);
      setProfilePhoto(photo);
    } else {
      const stored = localStorage.getItem('user_photo');
      if (stored) setProfilePhoto(stored);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_photo');
    setToken(null);
    setUser(null);
    setProfilePhoto(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, profilePhoto, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
