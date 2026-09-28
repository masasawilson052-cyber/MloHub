import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, Shadows } from '../../constants/theme';
import { UserEntity, UserRole } from '../../db/types';

import { useTheme } from '../../context/ThemeContext';

import { ThemeColors, lightColors } from '../../theme/palettes';
let colors: ThemeColors = lightColors;

interface AdminUsersManagerProps {
  currentUserId?: string;
  currentUserRole?: UserRole | string;
  adminUsers: UserEntity[];
  onGrantAdmin: (email: string, fullName: string, role: UserRole.ADMIN | UserRole.SUPER_ADMIN) => Promise<void>;
  onRevokeAdmin: (userId: string) => Promise<void>;
  language?: 'en' | 'sw';
}

export const AdminUsersManager: React.FC<AdminUsersManagerProps> = ({
  currentUserId,
  currentUserRole,
  adminUsers,
  onGrantAdmin,
  onRevokeAdmin,
  language = 'en',
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const isSuperAdmin = currentUserRole === UserRole.SUPER_ADMIN || currentUserRole === 'SUPER_ADMIN';

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole.ADMIN | UserRole.SUPER_ADMIN>(UserRole.ADMIN);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If user is not Super Admin, block access
  if (!isSuperAdmin) {
    return (
      <View style={styles.restrictedContainer}>
        <Ionicons name="lock-closed-outline" size={54} color="#ef4444" />
        <Text style={styles.restrictedTitle}>Access Restricted: Super Admin Required</Text>
        <Text style={styles.restrictedSubtitle}>
          Platform administrator management and role delegation is restricted exclusively to Super Administrators.
        </Text>
      </View>
    );
  }

  const handleCreateAdmin = async () => {
    if (!inviteEmail.trim() || !inviteName.trim()) {
      Alert.alert('Missing Fields', 'Please enter email address and full name.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onGrantAdmin(inviteEmail.trim().toLowerCase(), inviteName.trim(), selectedRole);
      setInviteEmail('');
      setInviteName('');
      setIsInviteOpen(false);
      Alert.alert('Success', `Administrative privileges granted to "${inviteName}".`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to grant administrative access.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = (targetUser: UserEntity) => {
    if (targetUser.id === currentUserId) {
      Alert.alert('Action Blocked', 'You cannot demote or revoke your own Super Admin access.');
      return;
    }

    const superAdminCount = adminUsers.filter(
      (u) => u.role === UserRole.SUPER_ADMIN || u.roles?.includes(UserRole.SUPER_ADMIN)
    ).length;

    const isTargetSuper = targetUser.role === UserRole.SUPER_ADMIN || targetUser.roles?.includes(UserRole.SUPER_ADMIN);
    if (isTargetSuper && superAdminCount <= 1) {
      Alert.alert('Action Blocked', 'Cannot demote the sole remaining Super Admin of the platform.');
      return;
    }

    Alert.alert(
      'Revoke Admin Privileges',
      `Are you sure you want to demote "${targetUser.fullName}" back to Customer? They will lose all platform governance permissions immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke Privileges',
          style: 'destructive',
          onPress: async () => {
            try {
              await onRevokeAdmin(targetUser.id);
              Alert.alert('Revoked', `Privileges revoked for "${targetUser.fullName}".`);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to revoke permissions.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>
            {language === 'sw' ? 'Wasimamizi wa Mfumo (Super Admin)' : 'Platform Administrators & Access Governance'}
          </Text>
          <Text style={styles.subtitle}>
            Manage trusted platform operators, assign administrative roles, and inspect operator credentials.
          </Text>
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={() => setIsInviteOpen(true)}>
          <Ionicons name="person-add" size={16} color={colors.onPrimary} />
          <Text style={styles.addBtnText}>Add Administrator</Text>
        </TouchableOpacity>
      </View>

      {/* Invite Modal / Box */}
      {isInviteOpen && (
        <View style={styles.inviteCard}>
          <Text style={styles.inviteCardTitle}>Provision New Platform Operator</Text>
          <View style={styles.inputGrid}>
            <TextInput
              style={styles.textInput}
              placeholder="Operator Full Name"
              value={inviteName}
              onChangeText={setInviteName}
            />
            <TextInput
              style={styles.textInput}
              placeholder="operator.email@mlohub.co.tz"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.roleSelectRow}>
            <Text style={styles.roleSelectLabel}>Assign Platform Role:</Text>
            <TouchableOpacity
              style={[styles.roleOption, selectedRole === UserRole.ADMIN && styles.roleOptionActive]}
              onPress={() => setSelectedRole(UserRole.ADMIN)}
            >
              <Text style={[styles.roleOptionText, selectedRole === UserRole.ADMIN && styles.roleOptionTextActive]}>
                ADMIN (Operations)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleOption, selectedRole === UserRole.SUPER_ADMIN && styles.roleOptionActiveSuper]}
              onPress={() => setSelectedRole(UserRole.SUPER_ADMIN)}
            >
              <Text style={[styles.roleOptionText, selectedRole === UserRole.SUPER_ADMIN && styles.roleOptionTextActiveSuper]}>
                SUPER ADMIN (Full Authority)
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inviteActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setIsInviteOpen(false)}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleCreateAdmin}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Text style={styles.submitText}>Grant Privileges</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Administrators Grid */}
      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.cardsGrid}>
          {adminUsers.map((admin) => {
            const isTargetSuper =
              admin.role === UserRole.SUPER_ADMIN || admin.roles?.includes(UserRole.SUPER_ADMIN);
            const isSelf = admin.id === currentUserId;

            return (
              <View key={admin.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatarCircle}>
                    <Ionicons
                      name={isTargetSuper ? 'shield-half-outline' : 'shield-outline'}
                      size={20}
                      color={isTargetSuper ? '#be185d' : '#1d4ed8'}
                    />
                  </View>
                  <View style={styles.nameArea}>
                    <View style={styles.nameRow}>
                      <Text style={styles.nameText}>{admin.fullName}</Text>
                      {isSelf && <Text style={styles.youBadge}>(You)</Text>}
                    </View>
                    <Text style={styles.emailText}>{admin.email}</Text>
                  </View>
                  <View style={[styles.roleTag, isTargetSuper ? styles.roleSuper : styles.roleAdmin]}>
                    <Text style={[styles.roleTagText, isTargetSuper ? styles.roleSuperText : styles.roleAdminText]}>
                      {isTargetSuper ? 'SUPER ADMIN' : 'ADMIN'}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardMeta}>
                  <Text style={styles.metaLabel}>ID: {admin.id}</Text>
                  <Text style={styles.metaLabel}>Phone: {admin.phone || 'No phone'}</Text>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.joinedText}>
                    Active Operator • {new Date(admin.createdAt).toLocaleDateString()}
                  </Text>
                  {!isSelf && (
                    <TouchableOpacity
                      style={styles.revokeBtn}
                      onPress={() => handleRevoke(admin)}
                    >
                      <Ionicons name="trash-outline" size={14} color="#ef4444" />
                      <Text style={styles.revokeText}>Revoke</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  restrictedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  restrictedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  restrictedSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 420,
    lineHeight: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    flexWrap: 'wrap',
    gap: Spacing.md,
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
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: Radii.md,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  inviteCard: {
    backgroundColor: colors.card,
    borderRadius: Radii.lg,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  inviteCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    minWidth: 220,
    backgroundColor: colors.appBackground,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    fontSize: 13,
  },
  roleSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  roleSelectLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  roleOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    backgroundColor: colors.surfaceInteractive,
  },
  roleOptionActive: {
    backgroundColor: colors.infoSoft,
    borderWidth: 1,
    borderColor: colors.info,
  },
  roleOptionActiveSuper: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  roleOptionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  roleOptionTextActive: {
    color: colors.info,
  },
  roleOptionTextActiveSuper: {
    color: colors.primary,
  },
  inviteActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: 4,
  },
  cancelBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    borderRadius: Radii.md,
  },
  submitText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  listContainer: {
    padding: Spacing.lg,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  card: {
    flex: 1,
    minWidth: 320,
    backgroundColor: colors.card,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: Radii.full,
    backgroundColor: colors.appBackground,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameArea: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nameText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  youBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  emailText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  roleTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
  },
  roleAdmin: {
    backgroundColor: colors.infoSoft,
  },
  roleSuper: {
    backgroundColor: colors.primarySoft,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  roleAdminText: {
    color: colors.info,
  },
  roleSuperText: {
    color: colors.primary,
  },
  cardMeta: {
    backgroundColor: colors.appBackground,
    borderRadius: Radii.sm,
    padding: Spacing.xs,
    gap: 2,
  },
  metaLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 6,
  },
  joinedText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  revokeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
    backgroundColor: colors.dangerSoft,
  },
  revokeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
  },
});
let styles = createStyles(lightColors);
