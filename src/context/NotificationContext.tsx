import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { Notificacao } from '@/types';
import { NOTIFICACOES_SEED } from '@/data/seed';

interface NotificationContextType {
  notifications: Notificacao[];
  unreadCount: (perfil: string) => number;
  markAsRead: (id: string) => void;
  markAllAsRead: (perfil: string) => void;
  addNotification: (n: Omit<Notificacao, 'id' | 'createdAt' | 'lida'>) => void;
  getForProfile: (perfil: string) => Notificacao[];
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notificacao[]>(NOTIFICACOES_SEED);

  const getForProfile = (perfil: string) =>
    notifications.filter(n => n.destinatarioPerfil.includes(perfil) || n.destinatarioPerfil.includes('Admin'));

  const unreadCount = (perfil: string) =>
    getForProfile(perfil).filter(n => !n.lida).length;

  const markAsRead = (id: string) =>
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));

  const markAllAsRead = (perfil: string) =>
    setNotifications(prev => prev.map(n =>
      (n.destinatarioPerfil.includes(perfil) || n.destinatarioPerfil.includes('Admin')) ? { ...n, lida: true } : n
    ));

  const addNotification = (n: Omit<Notificacao, 'id' | 'createdAt' | 'lida'>) => {
    const newN: Notificacao = {
      ...n,
      id: 'n' + Date.now(),
      createdAt: new Date().toISOString(),
      lida: false,
    };
    setNotifications(prev => [newN, ...prev]);
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, addNotification, getForProfile }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
