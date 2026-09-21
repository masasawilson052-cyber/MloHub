import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { runtimeConfig } from '../lib/runtimeConfig';
import { useMloHubDB } from '../context/DbContext';

// Reports API reachability only; it deliberately makes no payment/RLS claims.
export function ConnectionNotice() {
  const { error: dataError, refreshState } = useMloHubDB();
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);
  const check = async () => {
    if (runtimeConfig.allowLocalDataFallbacks) return;
    setChecking(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const result = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
        headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '' }, signal: controller.signal,
      });
      setOffline(!result.ok);
    } catch { setOffline(true); }
    finally { clearTimeout(timer); setChecking(false); }
  };
  useEffect(() => { void check(); const timer = setInterval(check, 30000); return () => clearInterval(timer); }, []);
  if (runtimeConfig.isDemo) return <View style={{padding:10,backgroundColor:'#fff3cd'}}><Text style={{textAlign:'center',color:'#724800'}}>Demo data · SMS and payments are simulated</Text></View>;
  if (!offline && !dataError) return null;
  return <View accessibilityRole="alert" style={{padding:12,backgroundColor:'#fff1f0',flexDirection:'row',gap:12,alignItems:'center'}}>
    <View style={{flex:1}}><Text style={{fontWeight:'700',color:'#9b241b'}}>{offline ? 'Connection unavailable / Hakuna muunganisho' : 'We could not load your data / Imeshindikana kupakia taarifa'}</Text><Text style={{color:'#713b35',marginTop:3}}>Please try again. If this continues, contact MloHub support.</Text></View>
    <TouchableOpacity disabled={checking} accessibilityRole="button" onPress={() => { void check(); refreshState(); }} style={{padding:10}}><Text style={{color:'#9b241b',fontWeight:'700'}}>{checking ? 'Checking…' : 'Retry'}</Text></TouchableOpacity>
  </View>;
}
