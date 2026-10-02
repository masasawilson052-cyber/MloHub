import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserRole } from '../../db/types';
import { AdminTabId, ADMIN_NAV_ITEMS } from './AdminSidebar';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

interface AdminMobileNavProps {
  activeTab: AdminTabId;
  onSelectTab: (tab: AdminTabId) => void;
  userRole?: UserRole | string;
  language?: 'en' | 'sw';
  badges?: {
    pendingApplications?: number;
    openReports?: number;
    staleMenus?: number;
    criticalAttention?: number;
    pendingRefunds?: number;
    pendingSettlements?: number;
  };
}

type NavGroupKey = 'HOME' | 'OPERATIONS' | 'MERCHANTS' | 'FINANCE' | 'MORE';

interface NavGroupDef {
  key: NavGroupKey;
  labelEn: string;
  labelSw: string;
  icon: keyof typeof Ionicons.glyphMap;
  tabs: AdminTabId[];
}

const NAV_GROUPS: NavGroupDef[] = [
  {
    key: 'HOME',
    labelEn: 'Home',
    labelSw: 'Mwanzo',
    icon: 'home',
    tabs: ['OVERVIEW'],
  },
  {
    key: 'OPERATIONS',
    labelEn: 'Operations',
    labelSw: 'Uendeshaji',
    icon: 'briefcase',
    tabs: ['ORDERS', 'REPORTS'],
  },
  {
    key: 'MERCHANTS',
    labelEn: 'Merchants',
    labelSw: 'Wafanyabiashara',
    icon: 'storefront',
    tabs: ['APPLICATIONS', 'RESTAURANTS', 'VERIFICATION'],
  },
  {
    key: 'FINANCE',
    labelEn: 'Finance',
    labelSw: 'Fedha',
    icon: 'cash',
    tabs: ['PAYMENTS', 'REFUNDS', 'SETTLEMENTS'],
  },
  {
    key: 'MORE',
    labelEn: 'More',
    labelSw: 'Zaidi',
    icon: 'ellipsis-horizontal',
    tabs: [
      'ANALYTICS',
      'NOTIFICATIONS',
      'USERS',
      'ADMIN_USERS',
      'AUDIT_LOGS',
      'HEALTH',
      'SETTINGS',
    ],
  },
];

export const AdminMobileNav: React.FC<AdminMobileNavProps> = ({
  activeTab,
  onSelectTab,
  userRole = UserRole.ADMIN,
  language = 'en',
  badges = {},
}) => {
  const isSuperAdmin = userRole === UserRole.SUPER_ADMIN || userRole === 'SUPER_ADMIN';
  const { colors: _tc } = useTheme();
  colors = _tc;
  styles = createStyles(colors);

  const [openGroup, setOpenGroup] = useState<NavGroupDef | null>(null);

  const getItemBadge = (tabId: AdminTabId): number => {
    switch (tabId) {
      case 'OVERVIEW':
        return badges.criticalAttention || 0;
      case 'APPLICATIONS':
        return badges.pendingApplications || 0;
      case 'REPORTS':
        return badges.openReports || 0;
      case 'VERIFICATION':
        return badges.staleMenus || 0;
      case 'REFUNDS':
        return badges.pendingRefunds || 0;
      case 'SETTLEMENTS':
        return badges.pendingSettlements || 0;
      default:
        return 0;
    }
  };

  const getGroupBadge = (group: NavGroupDef): number => {
    return group.tabs.reduce((sum, tabId) => sum + getItemBadge(tabId), 0);
  };

  const handleGroupPress = (group: NavGroupDef) => {
    if (group.key === 'HOME') {
      onSelectTab('OVERVIEW');
    } else {
      setOpenGroup(group);
    }
  };

  const handleTabSelect = (tabId: AdminTabId) => {
    setOpenGroup(null);
    onSelectTab(tabId);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.topbarBackground,
          borderTopColor: colors.border,
        },
      ]}
    >
      {/* 5 Grouped Primary Controls */}
      <View style={styles.tabBar}>
        {NAV_GROUPS.map((group) => {
          const isGroupActive = group.tabs.includes(activeTab);
          const groupBadge = getGroupBadge(group);

          return (
            <TouchableOpacity
              key={group.key}
              style={[
                styles.groupBtn,
                isGroupActive && { borderTopColor: colors.primary },
              ]}
              onPress={() => handleGroupPress(group)}
              accessibilityRole="button"
              accessibilityLabel={language === 'sw' ? group.labelSw : group.labelEn}
            >
              <View style={styles.iconWrapper}>
                <Ionicons
                  name={group.icon}
                  size={18}
                  color={isGroupActive ? colors.primary : colors.textSecondary}
                />
                {groupBadge > 0 && (
                  <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                    <Text style={[styles.badgeText, { color: colors.onPrimary }]}>
                      {groupBadge > 99 ? '99+' : groupBadge}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.groupLabel,
                  { color: isGroupActive ? colors.primary : colors.textSecondary },
                  isGroupActive && { fontWeight: '700' },
                ]}
              >
                {language === 'sw' ? group.labelSw : group.labelEn}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Group Navigation Modal / Bottom Sheet */}
      {openGroup && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setOpenGroup(null)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.backdropTouch}
              activeOpacity={1}
              onPress={() => setOpenGroup(null)}
            />
            <View
              style={[
                styles.sheetCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={[styles.sheetHeader, { borderBottomColor: colors.divider }]}>
                <View style={styles.sheetHeaderTitleRow}>
                  <Ionicons name={openGroup.icon} size={20} color={colors.primary} />
                  <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                    {language === 'sw' ? openGroup.labelSw : openGroup.labelEn}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.closeBtn, { backgroundColor: colors.surfaceHover }]}
                  onPress={() => setOpenGroup(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Close navigation sheet"
                >
                  <Ionicons name="close" size={18} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.itemsList}>
                {openGroup.tabs.map((tabId) => {
                  const navItem = ADMIN_NAV_ITEMS.find((item) => item.id === tabId);
                  if (!navItem) return null;
                  if (navItem.superAdminOnly && !isSuperAdmin) return null;

                  const isItemActive = activeTab === tabId;
                  const itemBadge = getItemBadge(tabId);

                  return (
                    <TouchableOpacity
                      key={tabId}
                      style={[
                        styles.sheetItemRow,
                        {
                          backgroundColor: isItemActive ? colors.surfaceHover : 'transparent',
                        },
                      ]}
                      onPress={() => handleTabSelect(tabId)}
                      accessibilityRole="button"
                      accessibilityLabel={language === 'sw' ? navItem.labelSw : navItem.labelEn}
                    >
                      <View style={styles.itemLeft}>
                        <Ionicons
                          name={navItem.icon}
                          size={18}
                          color={isItemActive ? colors.primary : colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.itemText,
                            { color: isItemActive ? colors.primary : colors.textPrimary },
                            isItemActive && { fontWeight: '700' },
                          ]}
                        >
                          {language === 'sw' ? navItem.labelSw : navItem.labelEn}
                        </Text>
                      </View>

                      <View style={styles.itemRight}>
                        {itemBadge > 0 && (
                          <View style={[styles.itemBadge, { backgroundColor: colors.dangerSoft }]}>
                            <Text style={[styles.itemBadgeText, { color: colors.danger }]}>
                              {itemBadge > 99 ? '99+' : itemBadge}
                            </Text>
                          </View>
                        )}
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={isItemActive ? colors.primary : colors.textMuted}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      borderTopWidth: 1,
      paddingBottom: Platform.OS === 'ios' ? 16 : 6,
    },
    tabBar: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      minHeight: 52,
    },
    groupBtn: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderTopWidth: 2,
      borderTopColor: 'transparent',
      paddingVertical: 6,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    iconWrapper: {
      position: 'relative',
    },
    groupLabel: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -8,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    badgeText: {
      fontSize: 9,
      fontWeight: '800',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      justifyContent: 'flex-end',
    },
    backdropTouch: {
      flex: 1,
    },
    sheetCard: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 28,
      maxHeight: '75%',
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: 12,
      borderBottomWidth: 1,
      marginBottom: 8,
    },
    sheetHeaderTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sheetTitle: {
      fontSize: 17,
      fontWeight: '800',
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    itemsList: {
      gap: 4,
    },
    sheetItemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: 48,
      paddingHorizontal: 12,
      borderRadius: 8,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    itemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    itemText: {
      fontSize: 14,
      fontWeight: '600',
    },
    itemRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    itemBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
    },
    itemBadgeText: {
      fontSize: 11,
      fontWeight: '700',
    },
  });

let styles = createStyles(lightColors);
