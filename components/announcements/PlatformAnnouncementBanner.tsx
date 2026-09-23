import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  PlatformAnnouncementsRepository,
  PlatformAnnouncement,
} from '../../repositories/platformAnnouncements.repository';

interface PlatformAnnouncementBannerProps {
  audience: 'CUSTOMERS' | 'RESTAURANTS';
  language?: 'en' | 'sw';
}

export const PlatformAnnouncementBanner: React.FC<PlatformAnnouncementBannerProps> = ({
  audience,
  language = 'en',
}) => {
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadActive = async () => {
      try {
        const list = await PlatformAnnouncementsRepository.listActiveForAudience(audience);
        if (isMounted) {
          setAnnouncements(list);
        }
      } catch (e) {
        console.warn('Failed to load active platform announcements:', e);
      }
    };

    loadActive();
    return () => {
      isMounted = false;
    };
  }, [audience]);

  if (announcements.length === 0) {
    return null;
  }

  // Display the highest priority active announcement
  const active = announcements[0];
  const title = (language === 'sw' && active.titleSw) ? active.titleSw : active.titleEn;
  const body = (language === 'sw' && active.bodySw) ? active.bodySw : active.bodyEn;

  const handleDismiss = async () => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== active.id));
    await PlatformAnnouncementsRepository.dismiss(active.id);
  };

  const handleCta = async () => {
    if (active.ctaUrl) {
      try {
        await Linking.openURL(active.ctaUrl);
      } catch (e) {
        console.warn('Could not open announcement URL:', active.ctaUrl);
      }
    }
  };

  const isUrgent = active.priority === 'URGENT';
  const isImportant = active.priority === 'HIGH' || active.priority === 'NORMAL';

  const containerStyle = [
    styles.container,
    isUrgent ? styles.urgentBg : isImportant ? styles.importantBg : styles.normalBg,
  ];

  const iconName = isUrgent
    ? 'alert-circle'
    : isImportant
    ? 'megaphone'
    : 'information-circle';

  const iconColor = isUrgent ? '#DC2626' : isImportant ? '#EA580C' : '#0284C7';

  return (
    <View style={containerStyle}>
      <View style={styles.contentRow}>
        <View style={styles.leftGroup}>
          <Ionicons name={iconName} size={18} color={iconColor} style={styles.icon} />
          <View style={styles.textContainer}>
            <Text style={styles.titleText}>{title}</Text>
            <Text style={styles.bodyText} numberOfLines={2}>
              {body}
            </Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {active.ctaLabel && (
            <TouchableOpacity
              style={[styles.ctaButton, isUrgent ? styles.urgentCta : styles.standardCta]}
              onPress={handleCta}
            >
              <Text style={styles.ctaText}>{active.ctaLabel}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss Announcement"
          >
            <Ionicons name="close" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    zIndex: 900,
  },
  urgentBg: {
    backgroundColor: '#FEF2F2',
    borderBottomColor: '#FCA5A5',
  },
  importantBg: {
    backgroundColor: '#FFF7ED',
    borderBottomColor: '#FDBA74',
  },
  normalBg: {
    backgroundColor: '#F0F9FF',
    borderBottomColor: '#BAE6FD',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1200,
    marginHorizontal: 'auto',
    width: '100%',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  icon: {
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  titleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  bodyText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ctaButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  urgentCta: {
    backgroundColor: '#EF4444',
  },
  standardCta: {
    backgroundColor: '#FA541C',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  dismissButton: {
    padding: 4,
    borderRadius: 4,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
});
