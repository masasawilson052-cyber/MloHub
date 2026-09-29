import React, { useEffect, useState } from 'react';
import { View, Text, Modal, ScrollView, TextInput, TouchableOpacity, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import { useTheme } from '../../context/ThemeContext';
export { LocationPreset, DAR_ES_SALAAM_LOCATION_PRESETS } from '../../constants/branchPresets';
export interface BranchLocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (loc: { region: string; district: string; ward: string; address: string; latitude: number; longitude: number }) => void;
  initialCoordinates?: { latitude?: number; longitude?: number };
  language?: 'en' | 'sw';
}
export const BranchLocationPickerModal: React.FC<BranchLocationPickerModalProps> = ({ visible, onClose, onSelectLocation, initialCoordinates, language='en' }) => {
  const { colors }=useTheme();
  const [latitude,setLatitude]=useState(''),[longitude,setLongitude]=useState('');
  const [address,setAddress]=useState(''),[region,setRegion]=useState(''),[district,setDistrict]=useState(''),[ward,setWard]=useState('');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false);
  useEffect(()=>{if(visible){setLatitude(initialCoordinates?.latitude?.toString()??'');setLongitude(initialCoordinates?.longitude?.toString()??'');setAddress('');setRegion('');setDistrict('');setWard('');setConfirmed(false);setError('');}},[visible]);
  const lat=Number(latitude),lng=Number(longitude);
  const valid=latitude.trim()!=='' && longitude.trim()!=='' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat)<=90 && Math.abs(lng)<=180;
  async function locate(){
    setBusy(true);setError('');setConfirmed(false);
    try{
      const permission=await Location.requestForegroundPermissionsAsync();
      if(permission.status!=='granted')throw new Error('Location permission denied. Enter exact coordinates manually.');
      const point=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.High});
      setLatitude(String(point.coords.latitude));setLongitude(String(point.coords.longitude));
      if(Platform.OS!=='web'){
        const results=await Location.reverseGeocodeAsync(point.coords);
        const result=results[0];
        if(result){setAddress([result.streetNumber,result.street,result.city].filter(Boolean).join(', '));setRegion(result.region??'');setDistrict(result.city??result.subregion??'');setWard(result.district??'');}
      }
      if(point.coords.accuracy==null || point.coords.accuracy>100)setError('GPS accuracy is limited. Check and adjust the coordinates before confirming.');
    }catch(e){setError(e instanceof Error?e.message:'Could not determine location. Enter exact coordinates manually.');}finally{setBusy(false);}
  }
  const input=(label:string,value:string,update:(value:string)=>void)=><View key={label} style={{gap:4}}><Text style={{color:colors.textPrimary}}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={v=>{update(v);setConfirmed(false);}} style={{padding:12,borderWidth:1,borderColor:colors.border,borderRadius:8,color:colors.textPrimary}} /></View>;
  const button=(label:string,action:()=>void,disabled=false)=><TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={action} style={{padding:14,backgroundColor:colors.primary,borderRadius:8,opacity:disabled?0.5:1}}><Text style={{color:colors.onPrimary}}>{label}</Text></TouchableOpacity>;
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><ScrollView contentContainerStyle={{padding:24,gap:16,backgroundColor:colors.card,flexGrow:1}}>
    <Text style={{fontSize:22,fontWeight:'700',color:colors.textPrimary}}>{language==='sw'?'Eneo halisi la tawi':'Exact branch location'}</Text>
    <Text style={{color:colors.textSecondary}}>Use GPS while at the storefront, or enter its exact coordinates and address. Open the map to check the pin, then confirm it identifies the customer entrance.</Text>
    {button(busy?'Locating…':'Use current GPS location',()=>{void locate();},busy)}
    {input('Latitude (-90 to 90)',latitude,setLatitude)}{input('Longitude (-180 to 180)',longitude,setLongitude)}
    {button('Check pin on map',()=>{void Linking.openURL(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=19/${lat}/${lng}`).catch(()=>setError('Could not open map'));},!valid)}
    {input('Street address / customer entrance',address,setAddress)}{input('Region',region,setRegion)}{input('District',district,setDistrict)}{input('Ward',ward,setWard)}
    {!!error && <Text accessibilityRole="alert" style={{color:colors.textPrimary}}>{error}</Text>}
    {button(confirmed?'Entrance location confirmed':'I checked this is the actual branch entrance',()=>setConfirmed(true),!valid||busy)}
    {button('Save branch location',()=>{if(valid&&confirmed&&address.trim()&&region.trim()&&district.trim()&&ward.trim()){onSelectLocation({latitude:lat,longitude:lng,address:address.trim(),region:region.trim(),district:district.trim(),ward:ward.trim()});onClose();}},!valid||!confirmed||busy||![address,region,district,ward].every(x=>x.trim()))}
    {button('Cancel',onClose)}
  </ScrollView></Modal>;
};
