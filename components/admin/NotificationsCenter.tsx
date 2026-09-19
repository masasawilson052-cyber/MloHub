import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { NotificationEntity } from '../../db/types';

interface NotificationsCenterProps {
  notifications: NotificationEntity[];
  onSendBroadcast: (
    title: string,
    message: string,
    audience: 'ALL' | 'CUSTOMERS' | 'RESTAURANTS'
  ) => Promise<void>;
  language?: 'en' | 'sw';
}

export const NotificationsCenter: React.FC<NotificationsCenterProps> = ({
  notifications,
  onSendBroadcast,
  language = 'en',
}) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<'ALL' | 'CUSTOMERS' | 'RESTAURANTS'>('ALL');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Incomplete Form', 'Please provide both title and announcement body.');
      return;
    }
    setIsSending(true);
    try {
      await onSendBroadcast(title.trim(), message.trim(), audience);
      setTitle('');
      setMessage('');
      Alert.alert('Success', 'Announcement broadcast dispatched successfully across the platform.');
    } catch (e: any) {
      Alert.alert('Broadcast Error', e.message || 'Failed to dispatch broadcast.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerArea}>
        <Text style={styles.title}>
          {language === 'sw' ? 'Kituo cha Matangazo na Taarifa' : 'Platform Announcements & Broadcast Center'}
        </Text>
        <Text style={styles.subtitle}>
          Publish system-wide alerts, holiday updates, or targeted vendor notices.
        </Text>
      </View>

      {/* Composer Card */}
      <View style={styles.composerCard}>
        <Text style={styles.composerTitle}>Compose Platform Broadcast</Text>

        <View style={styles.audienceRow}>
          <Text style={styles.audienceLabel}>Target Audience:</Text>
          <TouchableOpacity
            style={[styles.audiencePill, audience === 'ALL' && styles.audiencePillActive]}
            onPress={() => setAudience('ALL')}
          >
            <Text style={[styles.audiencePillText, audience === 'ALL' && styles.audiencePillTextActive]}>
              All Users
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.audiencePill, audience === 'CUSTOMERS' && styles.audiencePillActive]}
            onPress={() => setAudience('CUSTOMERS')}
          >
            <Text style={[styles.audiencePillText, audience === 'CUSTOMERS' && styles.audiencePillTextActive]}>
              Customers Only
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.audiencePill, audience === 'RESTAURANTS' && styles.audiencePillActive]}
            onPress={() => setAudience('RESTAURANTS')}
          >
            <Text style={[styles.audiencePillText, audience === 'RESTAURANTS' && styles.audiencePillTextActive]}>
              Restaurant Owners
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.inputTitle}
          placeholder="Announcement Title (e.g. Karibu Sikukuu / Weekend Special)"
          value={title}
          onChangeText={setTitle}
        />

        <TextInput
          style={styles.inputBody}
          placeholder="Write the announcement message here..."
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={4}
        />

        <View style={styles.composerFooter}>
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={handleSend}
            disabled={isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="megaphone" size={16} color="#ffffff" />
                <Text style={styles.sendBtnText}>Dispatch Broadcast</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Dispatches */}
      <View style={styles.historySection}>
        <Text style={styles.historyTitle}>Recent Dispatches & Notifications</Text>

        {notifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No notifications sent yet.</Text>
          </View>
        ) : (
          <View style={styles.notificationsList}>
            {notifications.slice(0, 10).map((n) => (
              <View key={n.id} style={styles.notificationCard}>
                <View style={styles.notifHeader}>
                  <Text style={styles.notifTitle}>{n.titleEn || n.titleSw}</Text>
                  <Text style={styles.notifDate}>
                    {new Date(n.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.notifMessage}>{n.messageEn || n.messageSw}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.xl,
  },
  headerArea: {
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  composerCard: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  composerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  audienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  audienceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  audiencePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radii.full,
    backgroundColor: '#f1f5f9',
  },
  audiencePillActive: {
    backgroundColor: Colors.primary,
  },
  audiencePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  audiencePillTextActive: {
    color: '#ffffff',
  },
  inputTitle: {
    backgroundColor: '#f8fafc',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  inputBody: {
    backgroundColor: '#f8fafc',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 13,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  composerFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radii.md,
  },
  sendBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  historySection: {
    gap: Spacing.sm,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.md,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  notificationsList: {
    gap: Spacing.sm,
  },
  notificationCard: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  notifDate: {
    fontSize: 11,
    color: '#94a3b8',
  },
  notifMessage: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
});
