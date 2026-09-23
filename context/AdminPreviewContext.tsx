import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from './AuthContext';

export interface AdminPreviewContextValue {
  isAdminPreview: boolean;
  enterPreview: () => Promise<void>;
  exitPreview: () => Promise<void>;
  clearPreview: () => void;
}

const AdminPreviewContext = createContext<AdminPreviewContextValue>({
  isAdminPreview: false,
  enterPreview: async () => {},
  exitPreview: async () => {},
  clearPreview: () => {},
});

export const AdminPreviewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const { switchWorkspace } = useAuth();
  // Session memory only: do NOT persist in AsyncStorage
  const [isAdminPreview, setIsAdminPreview] = useState(false);

  const enterPreview = useCallback(async () => {
    setIsAdminPreview(true);
    try {
      await switchWorkspace('CUSTOMER');
    } catch (e) {
      console.warn('Workspace switch to CUSTOMER failed during admin preview entry:', e);
    }
    router.replace('/(tabs)');
  }, [switchWorkspace, router]);

  const exitPreview = useCallback(async () => {
    setIsAdminPreview(false);
    try {
      await switchWorkspace('MLOHUB_ADMIN');
    } catch (e) {
      console.warn('Workspace switch to MLOHUB_ADMIN failed during admin preview exit:', e);
    }
    router.replace('/admin');
  }, [switchWorkspace, router]);

  const clearPreview = useCallback(() => {
    setIsAdminPreview(false);
  }, []);

  const value = useMemo(
    () => ({
      isAdminPreview,
      enterPreview,
      exitPreview,
      clearPreview,
    }),
    [isAdminPreview, enterPreview, exitPreview, clearPreview]
  );

  return <AdminPreviewContext.Provider value={value}>{children}</AdminPreviewContext.Provider>;
};

export const useAdminPreview = (): AdminPreviewContextValue => {
  return useContext(AdminPreviewContext);
};
