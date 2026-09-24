import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii } from '../../constants/theme';
import { Button } from '../ui/Button';

interface SupportModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ visible, onClose }) => {
  if (!visible) return null;

  const handleCall = () => {
    Linking.openURL('tel:+255754000111');
  };

  const handleEmail = () => {
    Linking.openURL('mailto:support@mlohub.co.tz?subject=MloHub%20Customer%20Support');
  };

  const handleWhatsApp = () => {
    Linking.openURL('https://wa.me/255754000111?text=Hello%20MloHub%20Support');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Help & Customer Support</Text>
              <Text style={styles.subtitle}>Dar es Salaam Local Support Team</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.infoBanner}>
              <Ionicons name="shield-checkmark" size={22} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>Direct Human Assistance</Text>
                <Text style={styles.bannerText}>
                  We believe in real answers, not artificial chatbot loops. Connect directly with our operations desk.
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.iconCircle}>
                <Ionicons name="call-outline" size={22} color={Colors.primary} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Phone Support</Text>
                <Text style={styles.cardVal}>+255 754 000 111</Text>
                <Text style={styles.cardSub}>Daily: 08:00 AM – 11:00 PM EAT</Text>
              </View>
              <TouchableOpacity onPress={handleCall} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Call</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <View style={[styles.iconCircle, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="logo-whatsapp" size={22} color="#15803D" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>WhatsApp Desk</Text>
                <Text style={styles.cardVal}>+255 754 000 111</Text>
                <Text style={styles.cardSub}>Fast response for live orders</Text>
              </View>
              <TouchableOpacity onPress={handleWhatsApp} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Chat</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="mail-outline" size={22} color="#0369A1" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Official Email</Text>
                <Text style={styles.cardVal}>support@mlohub.co.tz</Text>
                <Text style={styles.cardSub}>Inquiries, billing, and receipts</Text>
              </View>
              <TouchableOpacity onPress={handleEmail} style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Email</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="location-outline" size={22} color="#B45309" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Physical Operations Desk</Text>
                <Text style={styles.cardVal}>Masaki, Dar es Salaam</Text>
                <Text style={styles.cardSub}>Tanzania Platform Headquarters</Text>
              </View>
            </View>

            <Button
              title="Close"
              onPress={onClose}
              variant="outline"
              size="md"
              fullWidth={true}
              style={{ marginTop: Spacing.md }}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  scroll: {
    padding: Spacing.lg,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: Radii.md,
    padding: Spacing.md,
    gap: 12,
    marginBottom: Spacing.md,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
  },
  bannerText: {
    fontSize: 12,
    color: '#15803D',
    marginTop: 2,
    lineHeight: 18,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 2,
  },
  cardSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  actionBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: Radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
});
