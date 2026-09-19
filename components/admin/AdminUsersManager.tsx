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
          <Ionicons name="person-add" size={16} color="#ffffff" />
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
                <ActivityIndicator size="small" color="#ffffff" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
    color: '#0f172a',
  },
  restrictedSubtitle: {
    fontSize: 13,
    color: '#64748b',
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
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: Radii.md,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  inviteCard: {
    backgroundColor: '#ffffff',
    borderRadius: Radii.lg,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  inviteCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#f8fafc',
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    color: '#475569',
  },
  roleOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    backgroundColor: '#f1f5f9',
  },
  roleOptionActive: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  roleOptionActiveSuper: {
    backgroundColor: '#fdf2f8',
    borderWidth: 1,
    borderColor: '#ec4899',
  },
  roleOptionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  roleOptionTextActive: {
    color: '#1d4ed8',
  },
  roleOptionTextActiveSuper: {
    color: '#be185d',
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
    color: '#64748b',
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    borderRadius: Radii.md,
  },
  submitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
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
    backgroundColor: '#ffffff',
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    color: '#0f172a',
  },
  youBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  emailText: {
    fontSize: 12,
    color: '#64748b',
  },
  roleTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
  },
  roleAdmin: {
    backgroundColor: '#eff6ff',
  },
  roleSuper: {
    backgroundColor: '#fdf2f8',
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  roleAdminText: {
    color: '#1d4ed8',
  },
  roleSuperText: {
    color: '#be185d',
  },
  cardMeta: {
    backgroundColor: '#f8fafc',
    borderRadius: Radii.sm,
    padding: Spacing.xs,
    gap: 2,
  },
  metaLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 6,
  },
  joinedText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  revokeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
    backgroundColor: '#fef2f2',
  },
  revokeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },
});
