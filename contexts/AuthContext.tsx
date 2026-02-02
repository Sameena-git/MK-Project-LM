import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { getCurrentUser, switchUser as switchUserService, getUsers } from '../services/storage';

interface AuthContextType {
  currentUser: User;
  availableUsers: User[];
  login: (userId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(getCurrentUser());
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);

  useEffect(() => {
    setAvailableUsers(getUsers());
  }, []);

  const login = (userId: string) => {
    const user = switchUserService(userId);
    setCurrentUser(user);
  };

  return (
    <AuthContext.Provider value={{ currentUser, availableUsers, login }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};