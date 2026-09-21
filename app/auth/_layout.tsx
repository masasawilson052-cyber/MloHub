import React from 'react';
import { Stack } from 'expo-router';
import { Colors } from '../../constants/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register-customer" options={{ headerShown: false }} />
      <Stack.Screen name="register-restaurant" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="reset-password" options={{ headerShown: false }} />
    </Stack>
  );
}
