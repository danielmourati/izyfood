import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/types';

const demoUsers: { email: string; password: string; user: User }[] = [
  { email: 'admin@carnauba.com', password: '1234', user: { id: 'u1', name: 'Proprietário', email: 'admin@carnauba.com', role: 'admin', pin: '1234' } },
  { email: 'atendente@carnauba.com', password: '0000', user: { id: 'u2', name: 'Atendente', email: 'atendente@carnauba.com', role: 'atendente', pin: '0000' } },
];

interface AuthContextType {
  user: User | null;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('pos_user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (user) localStorage.setItem('pos_user', JSON.stringify(user));
    else localStorage.removeItem('pos_user');
  }, [user]);

  const login = (email: string, password: string) => {
    const found = demoUsers.find(u => u.email === email && u.password === password);
    if (found) { setUser(found.user); return true; }
    return false;
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
