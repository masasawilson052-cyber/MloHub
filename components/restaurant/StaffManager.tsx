import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { Typography } from '../../theme/typography';
import { RestaurantRole } from '../../types/auth';
import { Button } from '../ui/Button';

export interface StaffMember {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  role: RestaurantRole;
  isActive: boolean;
  joinedAt: string;
}

export interface StaffManagerProps {
  staffList: StaffMember[];
  currentUserId: string;
  onInviteStaff: (email: string, role: RestaurantRole, fullName: string) => Promise<void>;
  onChangeRole: (membershipId: string, newRole: RestaurantRole) => Promise<void>;
  onDeactivateStaff: (membershipId: string) => Promise<void>;
  language?: 'en' | 'sw';
}

const ROLES: { role: RestaurantRole; label: string; desc: string }[] = [
  { role: 'OWNER', label: 'Owner', desc: 'Full permissions including finances and staff' },
  { role: 'MANAGER', label: 'Manager', desc: 'Operational control of orders, menu, reviews and settings' },
  { role: 'CHEF', label: 'Head Chef', desc: 'Access to incoming orders, kitchen queue and menu availability' },
  { role: 'STAFF', label: 'Service Staff', desc: 'Read-only order view and table reservation management' },
];

export const StaffManager: React.FC<StaffManagerProps> = ({
  staffList,
  currentUserId,
  onInviteStaff,
  onChangeRole,
  onDeactivateStaff,
  language = 'en',
}) => {
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<RestaurantRole>('STAFF');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

  // Role Edit Modal
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<RestaurantRole>('STAFF');
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  const activeOwnersCount = staffList.filter((m) => m.role === 'OWNER' && m.isActive).length;

  const handleOpenEditRole = (member: StaffMember) => {
    setEditingMember(member);
    setSelectedNewRole(member.role);
  };

  const handleConfirmRoleChange = async () => {
    if (!editingMember) return;
    if (editingMember.role === 'OWNER' && selectedNewRole !== 'OWNER' && activeOwnersCount <= 1) {
      Alert.alert(
        'Owner Protection',
        'You cannot demote the last active owner of this restaurant. Please assign another owner first.'
      );
      return;
    }

    try {
      setIsSubmittingRole(true);
      await onChangeRole(editingMember.id, selectedNewRole);
      setEditingMember(null);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update staff role.');
    } finally {
      setIsSubmittingRole(false);
    }
  };

  const handleDeactivate = (member: StaffMember) => {
    if (member.role === 'OWNER' && activeOwnersCount <= 1) {
      Alert.alert(
        'Action Blocked (Last Owner)',
        'This restaurant must have at least one active Owner. Assign another owner before removing this account.'
      );
      return;
    }

    Alert.alert(
      'Deactivate Staff Member?',
      `Are you sure you want to deactivate ${member.fullName}? They will immediately lose access to this restaurant portal.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deactivate', style: 'destructive', onPress: () => onDeactivateStaff(member.id) },
      ]
    );
  };

  const handleConfirmInvite = async () => {
    if (!inviteEmail.trim() || !inviteName.trim()) {
      Alert.alert('Validation', 'Please provide staff full name and email address.');
      return;
    }
    try {
      setIsSubmittingInvite(true);
      await onInviteStaff(inviteEmail.trim(), inviteRole, inviteName.trim());
      setInviteModalVisible(false);
      setInviteEmail('');
      setInviteName('');
      Alert.alert('Invitation Sent', `An invitation to join as ${inviteRole} has been dispatched.`);
    } catch (err: any) {
      Alert.alert('Invite Failed', err?.message || 'Could not invite staff member.');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topRow}>
        <View>
          <Text style={styles.title}>Staff & Permissions</Text>
          <Text style={styles.sub}>
            Manage team members and grant role-based access for kitchen, front-of-house, and management.
          </Text>
        </View>

        <Button
          title="+ Invite Staff"
          onPress={() => setInviteModalVisible(true)}
          variant="primary"
          size="sm"
        />
      </View>

      {/* Staff List */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
        {staffList.map((member) => (
          <View key={member.id} style={styles.memberCard}>
            <View style={styles.memberLeft}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{member.fullName.charAt(0).toUpperCase()}</Text>
              </View>

              <View style={styles.memberDetails}>
                <View style={styles.nameRow}>
                  <Text style={styles.memberName}>{member.fullName}</Text>
                  {member.userId === currentUserId && (
                    <View style={styles.youBadge}>
                      <Text style={styles.youBadgeText}>YOU</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.memberEmail}>{member.email}</Text>
                {member.phone && <Text style={styles.memberPhone}>{member.phone}</Text>}
              </View>
            </View>

            <View style={styles.memberRight}>
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>{member.role}</Text>
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleOpenEditRole(member)}
                >
                  <Text style={styles.actionBtnText}>Change Role</Text>
                </TouchableOpacity>

                {member.userId !== currentUserId && member.isActive && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: Colors.error }]}
                    onPress={() => handleDeactivate(member)}
                  >
                    <Text style={[styles.actionBtnText, { color: Colors.error }]}>Deactivate</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Invite Modal */}
      <Modal visible={inviteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Team Member</Text>
              <TouchableOpacity onPress={() => setInviteModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Juma Hamisi"
                value={inviteName}
                onChangeText={setInviteName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="juma.hamisi@mlohub.tz"
                value={inviteEmail}
                onChangeText={setInviteEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <Text style={styles.inputLabel}>Select Portal Role</Text>
            <View style={styles.rolesRadioList}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r.role}
                  style={[styles.roleOption, inviteRole === r.role && styles.roleOptionActive]}
                  onPress={() => setInviteRole(r.role)}
                >
                  <View style={[styles.radioDot, inviteRole === r.role && styles.radioDotActive]} />
                  <View style={styles.roleTextCol}>
                    <Text style={styles.roleTitle}>{r.label}</Text>
                    <Text style={styles.roleDesc}>{r.desc}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActionsRow}>
              <Button
                title="Cancel"
                onPress={() => setInviteModalVisible(false)}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                title={isSubmittingInvite ? 'Inviting...' : 'Send Invite'}
                onPress={handleConfirmInvite}
                loading={isSubmittingInvite}
                variant="primary"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Role Modal */}
      <Modal visible={Boolean(editingMember)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Role for {editingMember?.fullName}</Text>
              <TouchableOpacity onPress={() => setEditingMember(null)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.rolesRadioList}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r.role}
                  style={[styles.roleOption, selectedNewRole === r.role && styles.roleOptionActive]}
                  onPress={() => setSelectedNewRole(r.role)}
                >
                  <View style={[styles.radioDot, selectedNewRole === r.role && styles.radioDotActive]} />
                  <View style={styles.roleTextCol}>
                    <Text style={styles.roleTitle}>{r.label}</Text>
                    <Text style={styles.roleDesc}>{r.desc}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActionsRow}>
              <Button
                title="Cancel"
                onPress={() => setEditingMember(null)}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                title={isSubmittingRole ? 'Updating...' : 'Save Role'}
                onPress={handleConfirmRoleChange}
                loading={isSubmittingRole}
                variant="primary"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.md,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  title: {
    ...Typography.H2,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sub: {
    ...Typography.Caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  listContainer: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  memberCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...Typography.H3,
    color: Colors.primaryDark,
    fontWeight: '800',
  },
  memberDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    ...Typography.BodyMedium,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  youBadge: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radii.sm,
  },
  youBadgeText: {
    ...Typography.Caption,
    fontSize: 9,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  memberEmail: {
    ...Typography.Caption,
    color: Colors.textMuted,
  },
  memberPhone: {
    ...Typography.Caption,
    color: Colors.textMuted,
  },
  memberRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  rolePill: {
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  rolePillText: {
    ...Typography.Caption,
    fontWeight: '700',
    fontSize: 11,
    color: Colors.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radii.sm,
  },
  actionBtnText: {
    ...Typography.Caption,
    fontWeight: '600',
    color: Colors.textSecondary,
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    maxWidth: 500,
    width: '100%',
    padding: Spacing.lg,
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.H3,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    ...Typography.Caption,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    ...Typography.Body,
  },
  rolesRadioList: {
    gap: 8,
    marginVertical: Spacing.sm,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surfaceSecondary,
    gap: Spacing.sm,
  },
  roleOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMuted,
  },
  radioDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  radioDotActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  roleTextCol: {
    flex: 1,
  },
  roleTitle: {
    ...Typography.BodyMedium,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  roleDesc: {
    ...Typography.Caption,
    color: Colors.textMuted,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
});
