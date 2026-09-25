import React, { useState, useEffect } from 'react';
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
import {
  PlatformAnnouncementsRepository,
  PlatformAnnouncement,
} from '../../repositories/platformAnnouncements.repository';
import { useTheme } from '../../context/ThemeContext';


import { ThemeColors, lightColors } from '../../theme/palettes';
let colors: ThemeColors = lightColors;

interface NotificationsCenterProps {
  notifications: NotificationEntity[];
  language?: 'en' | 'sw';
}

export const NotificationsCenter: React.FC<NotificationsCenterProps> = ({
  notifications,
  language = 'en',
}) => {
  const { colors: _tc, isDark } = useTheme(); colors = _tc; styles = createStyles(colors);
  const [titleEn, setTitleEn] = useState('');
  const [titleSw, setTitleSw] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [bodySw, setBodySw] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [audience, setAudience] = useState<'ALL' | 'CUSTOMERS' | 'RESTAURANTS'>('ALL');
  const [isSending, setIsSending] = useState(false);
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadAnnouncementsHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const list = await PlatformAnnouncementsRepository.listAllForAdmin();
      setAnnouncements(list);
    } catch (e: any) {
      console.warn('Failed to load announcements history:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadAnnouncementsHistory();
  }, []);

  const handleSend = async () => {
    if (!titleEn.trim() || !bodyEn.trim()) {
      Alert.alert('Incomplete Form', 'Please provide at least the English title and message body.');
      return;
    }
    setIsSending(true);
    try {
      await PlatformAnnouncementsRepository.publishAnnouncement({
        titleEn: titleEn.trim(),
        titleSw: titleSw.trim() || undefined,
        bodyEn: bodyEn.trim(),
        bodySw: bodySw.trim() || undefined,
        targetAudience: audience,
        priority,
        ctaLabel: ctaLabel.trim() || undefined,
        ctaUrl: ctaUrl.trim() || undefined,
      });

      setTitleEn('');
      setTitleSw('');
      setBodyEn('');
      setBodySw('');
      setCtaLabel('');
      setCtaUrl('');
      Alert.alert('Success', 'Announcement published and queued for in-app distribution.');
      await loadAnnouncementsHistory();
    } catch (e: any) {
      Alert.alert('Broadcast Error', e.message || 'Failed to dispatch broadcast.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDeactivate = async (announcementId: string) => {
    try {
      await PlatformAnnouncementsRepository.deactivateAnnouncement(announcementId);
      Alert.alert('Deactivated', 'Announcement has been deactivated.');
      await loadAnnouncementsHistory();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to deactivate announcement.');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.appBackground }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerArea}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {language === 'sw' ? 'Kituo cha Matangazo na Taarifa' : 'Platform Announcements & Broadcast Center'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          System-wide alerts, operational banners, and targeted stakeholder broadcasts with real receipt tracking.
        </Text>
      </View>

      {/* Broadcast Composer */}
      <View style={[styles.composerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.composerTitle, { color: colors.textPrimary }]}>Compose Platform Announcement</Text>

        <View style={styles.audienceRow}>
          <Text style={[styles.audienceLabel, { color: colors.textSecondary }]}>Target Audience:</Text>
          <TouchableOpacity
            style={[
              styles.audiencePill,
              { backgroundColor: colors.card, borderColor: colors.border },
              audience === 'ALL' && styles.audiencePillActive,
            ]}
            onPress={() => setAudience('ALL')}
          >
            <Text style={[styles.audiencePillText, { color: colors.textSecondary }, audience === 'ALL' && styles.audiencePillTextActive]}>
              All Stakeholders
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.audiencePill,
              { backgroundColor: colors.card, borderColor: colors.border },
              audience === 'CUSTOMERS' && styles.audiencePillActive,
            ]}
            onPress={() => setAudience('CUSTOMERS')}
          >
            <Text style={[styles.audiencePillText, { color: colors.textSecondary }, audience === 'CUSTOMERS' && styles.audiencePillTextActive]}>
              Customers Only
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.audiencePill,
              { backgroundColor: colors.card, borderColor: colors.border },
              audience === 'RESTAURANTS' && styles.audiencePillActive,
            ]}
            onPress={() => setAudience('RESTAURANTS')}
          >
            <Text style={[styles.audiencePillText, { color: colors.textSecondary }, audience === 'RESTAURANTS' && styles.audiencePillTextActive]}>
              Restaurant Owners
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.audienceRow}>
          <Text style={[styles.audienceLabel, { color: colors.textSecondary }]}>Priority:</Text>
          <TouchableOpacity
            style={[
              styles.audiencePill,
              { backgroundColor: colors.card, borderColor: colors.border },
              priority === 'NORMAL' && styles.audiencePillActive,
            ]}
            onPress={() => setPriority('NORMAL')}
          >
            <Text style={[styles.audiencePillText, { color: colors.textSecondary }, priority === 'NORMAL' && styles.audiencePillTextActive]}>
              Normal
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.audiencePill, priority === 'HIGH' && { backgroundColor: '#ea580c' }]}
            onPress={() => setPriority('HIGH')}
          >
            <Text style={[styles.audiencePillText, priority === 'HIGH' && { color: colors.onPrimary }]}>
              High
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.audiencePill, priority === 'URGENT' && { backgroundColor: '#dc2626' }]}
            onPress={() => setPriority('URGENT')}
          >
            <Text style={[styles.audiencePillText, priority === 'URGENT' && { color: colors.onPrimary }]}>
              Urgent (Red Alert)
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={[styles.inputTitle, { backgroundColor: colors.card, borderColor: colors.border, color: colors.textPrimary }]}
          placeholder="Announcement Title (English) *"
          placeholderTextColor={colors.inputPlaceholder}
          value={titleEn}
          onChangeText={setTitleEn}
        />

        <TextInput
          style={[styles.inputTitle, { backgroundColor: colors.card, borderColor: colors.border, color: colors.textPrimary }]}
          placeholder="Kichwa cha Tangazo (Kiswahili - Hiari)"
          placeholderTextColor={colors.inputPlaceholder}
          value={titleSw}
          onChangeText={setTitleSw}
        />

        <TextInput
          style={[styles.inputBody, { backgroundColor: colors.card, borderColor: colors.border, color: colors.textPrimary }]}
          placeholder="Announcement Message (English) *"
          placeholderTextColor={colors.inputPlaceholder}
          value={bodyEn}
          onChangeText={setBodyEn}
          multiline
          numberOfLines={3}
        />

        <TextInput
          style={[styles.inputBody, { backgroundColor: colors.card, borderColor: colors.border, color: colors.textPrimary }]}
          placeholder="Maelezo ya Tangazo (Kiswahili - Hiari)"
          placeholderTextColor={colors.inputPlaceholder}
          value={bodySw}
          onChangeText={setBodySw}
          multiline
          numberOfLines={3}
        />

        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <TextInput
            style={[styles.inputTitle, { flex: 1, backgroundColor: colors.card, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="CTA Button Label (Optional)"
            placeholderTextColor={colors.inputPlaceholder}
            value={ctaLabel}
            onChangeText={setCtaLabel}
          />
          <TextInput
            style={[styles.inputTitle, { flex: 2, backgroundColor: colors.card, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="CTA Target URL (e.g. https://mlohub.co.tz/promo)"
            placeholderTextColor={colors.inputPlaceholder}
            value={ctaUrl}
            onChangeText={setCtaUrl}
          />
        </View>

        <View style={styles.composerFooter}>
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={handleSend}
            disabled={isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <>
                <Ionicons name="megaphone" size={16} color={colors.onPrimary} />
                <Text style={styles.sendBtnText}>Publish Platform Announcement</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Active & Historical Announcements with Receipts */}
      <View style={styles.historySection}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.historyTitle, { color: colors.textPrimary }]}>Live Banners & Announcement History</Text>
          <TouchableOpacity onPress={loadAnnouncementsHistory} disabled={isLoadingHistory}>
            <Ionicons name="refresh" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {announcements.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No platform announcements published yet.</Text>
          </View>
        ) : (
          <View style={styles.notificationsList}>
            {announcements.map((a) => (
              <View key={a.id} style={[styles.notificationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.notifHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[styles.priorityBadge, a.priority === 'URGENT' ? styles.urgentBadge : a.priority === 'HIGH' ? styles.highBadge : styles.normalBadge]}>
                      <Text style={styles.priorityBadgeText}>{a.priority}</Text>
                    </View>
                    <Text style={[styles.notifTitle, { color: colors.textPrimary }]}>{a.titleEn}</Text>
                  </View>
                  <Text style={[styles.notifDate, { color: colors.textMuted }]}>
                    {new Date(a.sentAt || a.createdAt).toLocaleDateString()}
                  </Text>
                </View>

                {a.titleSw ? <Text style={[styles.swSubtitle, { color: colors.textSecondary }]}>Swahili: {a.titleSw}</Text> : null}
                <Text style={[styles.notifMessage, { color: colors.textSecondary }]}>{a.bodyEn}</Text>

                <View style={styles.announcementMetaRow}>
                  <Text style={[styles.announcementMetaText, { color: colors.textMuted }]}>Audience: {a.targetAudience}</Text>
                  <Text style={[styles.receiptsText, { color: colors.textMuted }]}>
                    Acknowledged: {a.acknowledgedCount ?? 0} receipts
                  </Text>

                  {a.isActive ? (
                    <TouchableOpacity
                      style={styles.deactivateBtn}
                      onPress={() => handleDeactivate(a.id)}
                    >
                      <Text style={styles.deactivateBtnText}>Deactivate</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.inactiveTag}>INACTIVE</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Recent Dispatches */}
      <View style={styles.historySection}>
        <Text style={[styles.historyTitle, { color: colors.textPrimary }]}>Recent Dispatches & Notifications</Text>

        {notifications.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No notifications sent yet.</Text>
          </View>
        ) : (
          <View style={styles.notificationsList}>
            {notifications.slice(0, 10).map((n) => (
              <View key={n.id} style={[styles.notificationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.notifHeader}>
                  <Text style={[styles.notifTitle, { color: colors.textPrimary }]}>{n.titleEn || n.titleSw}</Text>
                  <Text style={[styles.notifDate, { color: colors.textMuted }]}>
                    {new Date(n.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[styles.notifMessage, { color: colors.textSecondary }]}>{n.messageEn || n.messageSw}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBackground,
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
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  composerCard: {
    backgroundColor: colors.card,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  composerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
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
    color: colors.textSecondary,
  },
  audiencePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radii.full,
    backgroundColor: colors.surfaceInteractive,
  },
  audiencePillActive: {
    backgroundColor: colors.primary,
  },
  audiencePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  audiencePillTextActive: {
    color: colors.onPrimary,
  },
  inputTitle: {
    backgroundColor: colors.appBackground,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  inputBody: {
    backgroundColor: colors.appBackground,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radii.md,
  },
  sendBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  historySection: {
    gap: Spacing.sm,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  notificationsList: {
    gap: Spacing.sm,
  },
  notificationCard: {
    backgroundColor: colors.card,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textPrimary,
  },
  notifDate: {
    fontSize: 11,
    color: colors.textMuted,
  },
  notifMessage: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  urgentBadge: {
    backgroundColor: colors.dangerSoft,
  },
  highBadge: {
    backgroundColor: colors.warningSoft,
  },
  normalBadge: {
    backgroundColor: colors.surfaceInteractive,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  swSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 2,
  },
  announcementMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 6,
    marginTop: 4,
  },
  announcementMetaText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  receiptsText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.info,
  },
  deactivateBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    backgroundColor: colors.dangerSoft,
  },
  deactivateBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
  },
  inactiveTag: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
  },
});
let styles = createStyles(lightColors);
