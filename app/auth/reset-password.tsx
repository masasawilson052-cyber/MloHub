import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
  const { language } = useLanguage();
  const sw = language === 'sw';
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const hasExchangedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    // Check URL parameters for errors returned by Supabase Auth
    if (params.error || params.error_description) {
      if (mounted) {
        setValid(false);
        setError(params.error_description || (sw ? 'Kiungo kimeisha au si sahihi.' : 'Recovery link is invalid or expired.'));
        setReady(true);
      }
      return;
    }

    // Resolve code from query params or browser location
    let authCode = params.code;
    if (!authCode && typeof window !== 'undefined' && window.location?.search) {
      const searchParams = new URLSearchParams(window.location.search);
      authCode = searchParams.get('code') || undefined;
    }

    const initRecoverySession = async () => {
      // 1. If PKCE authorization code is present in URL, exchange it once
      if (authCode && !hasExchangedRef.current) {
        hasExchangedRef.current = true;
        try {
          const { data, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(authCode);
          if (exchangeErr || !data.session) {
            if (mounted) {
              setValid(false);
              setError(sw ? 'Kiungo kimeisha au tayari kimetumika.' : 'This recovery link has expired or has already been used.');
              setReady(true);
            }
            return;
          }
          if (mounted) {
            setValid(true);
            setReady(true);
          }
          return;
        } catch {
          if (mounted) {
            setValid(false);
            setReady(true);
          }
          return;
        }
      }

      // 2. Otherwise inspect active session (e.g. established via implicit hash or existing exchange)
      try {
        const { data, error: sessionErr } = await supabase.auth.getSession();
        if (mounted) {
          // Verify session exists and is authenticated
          setValid(!sessionErr && !!data.session);
          setReady(true);
        }
      } catch {
        if (mounted) {
          setValid(false);
          setReady(true);
        }
      }
    };

    // 3. Listen to auth state changes for PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && newSession)) {
        setValid(true);
        setReady(true);
      }
    });

    initRecoverySession();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [params.code, params.error, params.error_description, sw]);

  const save = async () => {
    if (password.length < 10) {
      setError(sw ? 'Tumia angalau herufi 10.' : 'Use at least 10 characters.');
      return;
    }
    if (password !== confirm) {
      setError(sw ? 'Nywila hazifanani.' : 'Passwords do not match.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;
      // Invalidate recovery session on password completion
      await supabase.auth.signOut();
      setDone(true);
      setPassword('');
      setConfirm('');
    } catch (err: any) {
      setError(err?.message || (sw ? 'Imeshindikana kubadilisha nenosiri. Omba kiungo kipya au jaribu tena.' : 'Password could not be changed. Request a fresh link or try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.brand}>MloHub</Text>
        <Text style={styles.title}>
          {done ? (sw ? 'Nenosiri limebadilishwa' : 'Password updated') : (sw ? 'Weka nenosiri jipya' : 'Choose a new password')}
        </Text>
        {!ready ? (
          <ActivityIndicator size="large" color="#166534" style={{ marginVertical: 20 }} />
        ) : done ? (
          <>
            <Text style={styles.body}>
              {sw ? 'Nenosiri lako jipya limehifadhiwa salama. Ingia ili kuendelea.' : 'Your new password has been saved securely. Sign in to continue.'}
            </Text>
            <TouchableOpacity style={styles.button} onPress={() => router.replace('/auth/login')}>
              <Text style={styles.buttonText}>{sw ? 'Ingia' : 'Sign in'}</Text>
            </TouchableOpacity>
          </>
        ) : !valid ? (
          <>
            <Text style={styles.body}>
              {error || (sw ? 'Kiungo hiki kimeisha muda au si sahihi.' : 'This recovery link has expired or is invalid.')}
            </Text>
            <TouchableOpacity style={styles.button} onPress={() => router.replace('/auth/forgot-password')}>
              <Text style={styles.buttonText}>{sw ? 'Omba kiungo kipya' : 'Request a new link'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.body}>
              {sw ? 'Tumia angalau herufi 10. Usitumie nenosiri ulilotumia mahali pengine.' : 'Use at least 10 characters and a password you do not use elsewhere.'}
            </Text>
            <TextInput
              accessibilityLabel="New password"
              style={styles.input}
              placeholder={sw ? 'Nenosiri jipya' : 'New password'}
              secureTextEntry
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
            />
            <TextInput
              accessibilityLabel="Confirm new password"
              style={styles.input}
              placeholder={sw ? 'Rudia nenosiri' : 'Confirm new password'}
              secureTextEntry
              autoCapitalize="none"
              value={confirm}
              onChangeText={setConfirm}
            />
            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            <TouchableOpacity disabled={saving} style={[styles.button, saving && { opacity: 0.6 }]} onPress={save}>
              <Text style={styles.buttonText}>
                {saving ? (sw ? 'Inahifadhi…' : 'Saving…') : (sw ? 'Hifadhi nenosiri' : 'Save password')}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({page:{flex:1,backgroundColor:'#faf8f3',justifyContent:'center',padding:24},card:{width:'100%',maxWidth:460,alignSelf:'center',padding:28,backgroundColor:'#fff',borderRadius:24,gap:16},brand:{fontSize:16,fontWeight:'800',color:'#166534'},title:{fontSize:26,fontWeight:'800',color:'#163126'},body:{fontSize:15,lineHeight:23,color:'#526159'},input:{borderWidth:1,borderColor:'#ccd6ce',padding:15,borderRadius:12,fontSize:16},button:{backgroundColor:'#166534',padding:16,borderRadius:12,alignItems:'center'},buttonText:{color:'#fff',fontWeight:'700',fontSize:15},error:{color:'#b42318',fontSize:14}});
