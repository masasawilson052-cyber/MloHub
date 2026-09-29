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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NotificationEntity } from '../../db/types';
import { NotificationEventOutbox } from '../../types/domain';
import {
  PlatformAnnouncementsRepository,
  PlatformAnnouncement,
} from '../../repositories/platformAnnouncements.repository';
import { NotificationOutboxRepository } from '../../repositories/notificationOutbox.repository';
import { useTheme } from '../../context/ThemeContext';
import { AdminDataState } from './AdminDataState';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

interface NotificationsCenterProps {
  notifications?: NotificationEntity[];
  language?: 'en' | 'sw';
}

type ScreenTab = 'ANNOUNCEMENTS' | 'DELIVERY_HEALTH';

export const NotificationsCenter: React.FC<NotificationsCenterProps> = ({
  notifications = [],
  language = 'en',
}) => {
  const { colors: _tc } = useTheme();
  colors = _tc;
  styles = createStyles(colors);

  const [activeTab, setActiveTab] = useState<ScreenTab>('ANNOUNCEMENTS');

  // Announcements Form & State
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
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);

  // Delivery Health Outbox State
  const [outboxEvents, setOutboxEvents] = useState<NotificationEventOutbox[]>([]);
  const [isLoadingOutbox, setIsLoadingOutbox] = useState(false);
  const [outboxError, setOutboxError] = useState<string | null>(null);

  const loadAnnouncementsHistory = async () => {
    setIsLoadingHistory(true);
    setAnnouncementsError(null);
    try {
      const list = await PlatformAnnouncementsRepository.listAllForAdmin();
      setAnnouncements(list);
    } catch (e: any) {
      console.warn('Failed to load announcements history:', e);
      setAnnouncementsError(e?.message || 'Unable to load platform announcements.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadOutboxHealth = async () => {
    setIsLoadingOutbox(true);
    setOutboxError(null);
    try {
      const events = await NotificationOutboxRepository.listDeliveryHealthEvents(50);
      setOutboxEvents(events);
    } catch (e: any) {
      console.warn('Failed to load notification outbox events:', e);
      setOutboxError(e?.message || 'Unable to load delivery health records.');
    } finally {
      setIsLoadingOutbox(false);
    }
  };

  useEffect(() => {
    loadAnnouncementsHistory();
    loadOutboxHealth();
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

  // Delivery Health Calculations
  const deadLetterCount = outboxEvents.filter((e) => e.processingStatus === 'DEAD_LETTER').length;
  const failedCount = outboxEvents.filter((e) => e.processingStatus === 'FAILED').length;
  const pendingCount = outboxEvents.filter((e) => e.processingStatus === 'PENDING').length;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.appBackground }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Area */}
      <View style={styles.headerArea}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {language === 'sw' ? 'Kituo cha Mawasiliano na Taarifa' : 'Communication & Delivery Center'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            System-wide broadcast management, customer/merchant alerts, and notification pipeline delivery surveillance.
          </Text>
        </View>

        {/* Screen Level Tabs */}
        <View style={styles.screenTabsRow}>
          <TouchableOpacity
            style={[
              styles.screenTabBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
              activeTab === 'ANNOUNCEMENTS' && {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => setActiveTab('ANNOUNCEMENTS')}
          >
            <Ionicons
              name="megaphone-outline"
              size={15}
              color={activeTab === 'ANNOUNCEMENTS' ? colors.onPrimary : colors.textSecondary}
            />
            <Text
              style={[
                styles.screenTabText,
                { color: colors.textSecondary },
                activeTab === 'ANNOUNCEMENTS' && { color: colors.onPrimary, fontWeight: '700' },
              ]}
            >
              Announcements ({announcements.filter((a) => a.isActive).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.screenTabBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
              activeTab === 'DELIVERY_HEALTH' && {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => setActiveTab('DELIVERY_HEALTH')}
          >
            <Ionicons
              name="pulse-outline"
              size={15}
              color={activeTab === 'DELIVERY_HEALTH' ? colors.onPrimary : colors.textSecondary}
            />
            <Text
              style={[
                styles.screenTabText,
                { color: colors.textSecondary },
                activeTab === 'DELIVERY_HEALTH' && { color: colors.onPrimary, fontWeight: '700' },
              ]}
            >
              Delivery Health
            </Text>
            {(deadLetterCount > 0 || failedCount > 0) && (
              <View style={[styles.tabBadge, { backgroundColor: colors.danger }]}>
                <Text style={[styles.tabBadgeText, { color: colors.onPrimary }]}>
                  {deadLetterCount + failedCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* TAB 1: ANNOUNCEMENTS */}
      {activeTab === 'ANNOUNCEMENTS' && (
        <>
          {/* Broadcast Composer */}
          <View style={[styles.composerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.composerTitle, { color: colors.textPrimary }]}>
              Compose Platform Announcement
            </Text>

            <View style={styles.audienceRow}>
              <Text style={[styles.audienceLabel, { color: colors.textSecondary }]}>Target Audience:</Text>
              {(
                [
                  { id: 'ALL', label: 'All Stakeholders' },
                  { id: 'CUSTOMERS', label: 'Customers Only' },
                  { id: 'RESTAURANTS', label: 'Restaurant Owners' },
                ] as const
              ).map((aud) => (
                <TouchableOpacity
                  key={aud.id}
                  style={[
                    styles.audiencePill,
                    { backgroundColor: colors.surfaceHover, borderColor: colors.border },
                    audience === aud.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setAudience(aud.id)}
                >
                  <Text
                    style={[
                      styles.audiencePillText,
                      { color: colors.textSecondary },
                      audience === aud.id && { color: colors.onPrimary, fontWeight: '700' },
                    ]}
                  >
                    {aud.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.audienceRow}>
              <Text style={[styles.audienceLabel, { color: colors.textSecondary }]}>Priority:</Text>
              {(
                [
                  { id: 'NORMAL', label: 'Normal', activeColor: colors.primary },
                  { id: 'HIGH', label: 'High', activeColor: colors.warning },
                  { id: 'URGENT', label: 'Urgent Alert', activeColor: colors.danger },
                ] as const
              ).map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.audiencePill,
                    { backgroundColor: colors.surfaceHover, borderColor: colors.border },
                    priority === p.id && { backgroundColor: p.activeColor, borderColor: p.activeColor },
                  ]}
                  onPress={() => setPriority(p.id)}
                >
                  <Text
                    style={[
                      styles.audiencePillText,
                      { color: colors.textSecondary },
                      priority === p.id && { color: colors.onPrimary, fontWeight: '700' },
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.inputTitle, { backgroundColor: colors.appBackground, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="Announcement Title (English) *"
              placeholderTextColor={colors.inputPlaceholder}
              value={titleEn}
              onChangeText={setTitleEn}
            />

            <TextInput
              style={[styles.inputTitle, { backgroundColor: colors.appBackground, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="Kichwa cha Tangazo (Kiswahili - Hiari)"
              placeholderTextColor={colors.inputPlaceholder}
              value={titleSw}
              onChangeText={setTitleSw}
            />

            <TextInput
              style={[styles.inputBody, { backgroundColor: colors.appBackground, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="Announcement Message (English) *"
              placeholderTextColor={colors.inputPlaceholder}
              value={bodyEn}
              onChangeText={setBodyEn}
              multiline
              numberOfLines={3}
            />

            <TextInput
              style={[styles.inputBody, { backgroundColor: colors.appBackground, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="Maelezo ya Tangazo (Kiswahili - Hiari)"
              placeholderTextColor={colors.inputPlaceholder}
              value={bodySw}
              onChangeText={setBodySw}
              multiline
              numberOfLines={3}
            />

            <View style={styles.ctaRow}>
              <TextInput
                style={[styles.inputTitle, { flex: 1, backgroundColor: colors.appBackground, borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="CTA Button Label (Optional)"
                placeholderTextColor={colors.inputPlaceholder}
                value={ctaLabel}
                onChangeText={setCtaLabel}
              />
              <TextInput
                style={[styles.inputTitle, { flex: 2, backgroundColor: colors.appBackground, borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="CTA Target URL (e.g. /orders or https://mlohub.co.tz)"
                placeholderTextColor={colors.inputPlaceholder}
                value={ctaUrl}
                onChangeText={setCtaUrl}
              />
            </View>

            <View style={styles.composerFooter}>
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: colors.primary }]}
                onPress={handleSend}
                disabled={isSending}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <>
                    <Ionicons name="megaphone" size={16} color={colors.onPrimary} />
                    <Text style={[styles.sendBtnText, { color: colors.onPrimary }]}>
                      Publish Platform Announcement
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Active Announcements History */}
          <View style={styles.historySection}>
            <View style={styles.historyHeader}>
              <Text style={[styles.historyTitle, { color: colors.textPrimary }]}>
                Platform Announcement History
              </Text>
              <TouchableOpacity
                style={[styles.refreshIconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={loadAnnouncementsHistory}
                disabled={isLoadingHistory}
              >
                <Ionicons name="refresh" size={14} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <AdminDataState
              loading={isLoadingHistory}
              error={announcementsError}
              isEmpty={announcements.length === 0}
              emptyTitle="No Announcements Dispatched"
              emptySubtitle="No platform broadcasts currently published."
              emptyIcon="megaphone-outline"
              onRetry={loadAnnouncementsHistory}
            >
              <View style={styles.announcementsList}>
                {announcements.map((a) => (
                  <View
                    key={a.id}
                    style={[styles.announcementCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={styles.announcementHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.announcementTitle, { color: colors.textPrimary }]}>
                          {a.titleEn}
                        </Text>
                        {a.titleSw && (
                          <Text style={[styles.announcementTitleSw, { color: colors.textSecondary }]}>
                            {a.titleSw}
                          </Text>
                        )}
                      </View>
                      <View
                        style={[
                          styles.priorityBadge,
                          {
                            backgroundColor:
                              a.priority === 'URGENT'
                                ? colors.dangerSoft
                                : a.priority === 'HIGH'
                                ? colors.warningSoft
                                : colors.infoSoft,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.priorityBadgeText,
                            {
                              color:
                                a.priority === 'URGENT'
                                  ? colors.danger
                                  : a.priority === 'HIGH'
                                  ? colors.warning
                                  : colors.info,
                            },
                          ]}
                        >
                          {a.priority}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.announcementBody, { color: colors.textSecondary }]}>
                      {a.bodyEn}
                    </Text>

                    <View style={[styles.announcementFooter, { borderTopColor: colors.divider }]}>
                      <Text style={[styles.metaText, { color: colors.textMuted }]}>
                        Audience: {a.targetAudience} | Receipts: {a.acknowledgedCount ?? 0}
                      </Text>

                      {a.isActive ? (
                        <TouchableOpacity
                          style={[styles.deactivateBtn, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}
                          onPress={() => handleDeactivate(a.id)}
                        >
                          <Text style={[styles.deactivateBtnText, { color: colors.danger }]}>Deactivate</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.inactiveTag, { backgroundColor: colors.surfaceHover }]}>
                          <Text style={[styles.inactiveTagText, { color: colors.textMuted }]}>INACTIVE</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </AdminDataState>
          </View>
        </>
      )}

      {/* TAB 2: DELIVERY HEALTH */}
      {activeTab === 'DELIVERY_HEALTH' && (
        <View style={styles.deliveryHealthSection}>
          {/* Health Summary Cards */}
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Dead-Letter (Critical)</Text>
              <Text style={[styles.kpiValue, { color: deadLetterCount > 0 ? colors.danger : colors.textPrimary }]}>
                {deadLetterCount}
              </Text>
              <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Exceeded retry limit</Text>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Failed Attempts</Text>
              <Text style={[styles.kpiValue, { color: failedCount > 0 ? colors.warning : colors.textPrimary }]}>
                {failedCount}
              </Text>
              <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Awaiting background retry</Text>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Pending Outbox</Text>
              <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{pendingCount}</Text>
              <Text style={[styles.kpiSub, { color: colors.textMuted }]}>Queued for dispatch</Text>
            </View>
          </View>

          {/* Outbox Pipeline List */}
          <View style={styles.historyHeader}>
            <Text style={[styles.historyTitle, { color: colors.textPrimary }]}>
              Pipeline Delivery Errors & Dead-Letter Log
            </Text>
            <TouchableOpacity
              style={[styles.refreshIconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={loadOutboxHealth}
              disabled={isLoadingOutbox}
            >
              <Ionicons name="refresh" size={14} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <AdminDataState
            loading={isLoadingOutbox}
            error={outboxError}
            isEmpty={outboxEvents.length === 0}
            emptyTitle="All Delivery Channels Healthy"
            emptySubtitle="No dead-letter notifications or active delivery failures found in the outbox queue."
            emptyIcon="checkmark-circle-outline"
            onRetry={loadOutboxHealth}
          >
            <View style={styles.outboxList}>
              {outboxEvents.map((event) => {
                const isDead = event.processingStatus === 'DEAD_LETTER';
                const isFailed = event.processingStatus === 'FAILED';

                const badgeBg = isDead
                  ? colors.dangerSoft
                  : isFailed
                  ? colors.warningSoft
                  : colors.infoSoft;
                const badgeColor = isDead
                  ? colors.danger
                  : isFailed
                  ? colors.warning
                  : colors.info;

                return (
                  <View
                    key={event.id}
                    style={[styles.outboxCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={styles.outboxCardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.outboxBadgeRow}>
                          <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                            <Text style={[styles.statusBadgeText, { color: badgeColor }]}>
                              {event.processingStatus}
                            </Text>
                          </View>
                          <Text style={[styles.eventType, { color: colors.textPrimary }]}>
                            {event.eventType}
                          </Text>
                        </View>
                        <Text style={[styles.aggregateText, { color: colors.textMuted }]}>
                          Aggregate: {event.aggregateType} ({event.aggregateId})
                        </Text>
                      </View>

                      <View style={styles.priorityBox}>
                        <Text style={[styles.priorityText, { color: colors.textSecondary }]}>
                          Priority: {event.priority}
                        </Text>
                        <Text style={[styles.retriesText, { color: colors.textMuted }]}>
                          Retries: {event.retryCount} / {event.maxRetries}
                        </Text>
                      </View>
                    </View>

                    {event.lastError && (
                      <View style={[styles.errorDetailBox, { backgroundColor: colors.dangerSoft }]}>
                        <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
                        <Text style={[styles.errorDetailText, { color: colors.danger }]}>
                          {event.lastError}
                        </Text>
                      </View>
                    )}

                    <View style={[styles.outboxCardFooter, { borderTopColor: colors.divider }]}>
                      <Text style={[styles.metaText, { color: colors.textMuted }]}>
                        Event ID: {event.id}
                      </Text>
                      <Text style={[styles.metaText, { color: colors.textMuted }]}>
                        Created: {new Date(event.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </AdminDataState>
        </View>
      )}
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      padding: 24,
      gap: 20,
    },
    headerArea: {
      gap: 12,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 13,
      maxWidth: 700,
    },
    screenTabsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    screenTabBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    screenTabText: {
      fontSize: 12,
      fontWeight: '600',
    },
    tabBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 10,
    },
    tabBadgeText: {
      fontSize: 10,
      fontWeight: '800',
    },
    composerCard: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 18,
      gap: 12,
    },
    composerTitle: {
      fontSize: 15,
      fontWeight: '700',
    },
    audienceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    audienceLabel: {
      fontSize: 12,
      fontWeight: '600',
    },
    audiencePill: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 6,
      borderWidth: 1,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    audiencePillText: {
      fontSize: 11,
      fontWeight: '600',
    },
    inputTitle: {
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 13,
      fontWeight: '600',
    },
    inputBody: {
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 13,
      minHeight: 70,
      textAlignVertical: 'top',
    },
    ctaRow: {
      flexDirection: 'row',
      gap: 10,
      flexWrap: 'wrap',
    },
    composerFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    sendBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    sendBtnText: {
      fontSize: 13,
      fontWeight: '700',
    },
    historySection: {
      gap: 12,
    },
    historyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    historyTitle: {
      fontSize: 15,
      fontWeight: '700',
    },
    refreshIconBtn: {
      width: 28,
      height: 28,
      borderRadius: 6,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    announcementsList: {
      gap: 10,
    },
    announcementCard: {
      borderRadius: 10,
      borderWidth: 1,
      padding: 14,
      gap: 8,
    },
    announcementHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 10,
    },
    announcementTitle: {
      fontSize: 14,
      fontWeight: '700',
    },
    announcementTitleSw: {
      fontSize: 12,
      fontStyle: 'italic',
      marginTop: 2,
    },
    priorityBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    priorityBadgeText: {
      fontSize: 10,
      fontWeight: '800',
    },
    announcementBody: {
      fontSize: 12,
      lineHeight: 16,
    },
    announcementFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 8,
      borderTopWidth: 1,
    },
    metaText: {
      fontSize: 11,
    },
    deactivateBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    deactivateBtnText: {
      fontSize: 11,
      fontWeight: '700',
    },
    inactiveTag: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
    },
    inactiveTagText: {
      fontSize: 10,
      fontWeight: '700',
    },
    deliveryHealthSection: {
      gap: 16,
    },
    kpiRow: {
      flexDirection: 'row',
      gap: 12,
      flexWrap: 'wrap',
    },
    kpiCard: {
      flex: 1,
      minWidth: 150,
      padding: 14,
      borderRadius: 10,
      borderWidth: 1,
    },
    kpiLabel: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    kpiValue: {
      fontSize: 20,
      fontWeight: '800',
      marginVertical: 4,
    },
    kpiSub: {
      fontSize: 11,
    },
    outboxList: {
      gap: 10,
    },
    outboxCard: {
      borderRadius: 10,
      borderWidth: 1,
      padding: 14,
      gap: 8,
    },
    outboxCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 10,
    },
    outboxBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    statusBadgeText: {
      fontSize: 10,
      fontWeight: '800',
    },
    eventType: {
      fontSize: 13,
      fontWeight: '700',
    },
    aggregateText: {
      fontSize: 11,
      marginTop: 2,
    },
    priorityBox: {
      alignItems: 'flex-end',
    },
    priorityText: {
      fontSize: 11,
      fontWeight: '600',
    },
    retriesText: {
      fontSize: 11,
    },
    errorDetailBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      padding: 8,
      borderRadius: 6,
    },
    errorDetailText: {
      fontSize: 11,
      fontWeight: '600',
      flex: 1,
    },
    outboxCardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 8,
      borderTopWidth: 1,
      flexWrap: 'wrap',
      gap: 6,
    },
  });

let styles = createStyles(lightColors);
