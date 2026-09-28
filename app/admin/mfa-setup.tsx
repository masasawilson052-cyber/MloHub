import React from 'react';
import { useRouter } from 'expo-router';
import { AdminMfaSetup } from '../../components/admin/security/AdminMfaSetup';
import { useAuth } from '../../context/AuthContext';

export default function AdminMfaSetupScreen() {
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <AdminMfaSetup
      onSuccess={() => {
        router.replace('/admin');
      }}
      onCancel={logout}
    />
  );
}
