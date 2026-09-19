import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';
import { Shadows } from '../../theme/shadows';

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  style,
  contentStyle,
  showCloseButton = true,
}) => {
  return (
    <RNModal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardContainer}
          >
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={[styles.dialog, style]}>
                {title || showCloseButton ? (
                  <View style={styles.header}>
                    <View style={styles.headerTitles}>
                      {title ? <Text style={styles.title}>{title}</Text> : null}
                      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                    </View>
                    {showCloseButton ? (
                      <TouchableOpacity
                        onPress={onClose}
                        style={styles.closeBtn}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel="Close dialog"
                      >
                        <Ionicons name="close" size={22} color={Colors.brandInk} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}

                <View style={[styles.body, contentStyle]}>{children}</View>

                {footer ? <View style={styles.footer}>{footer}</View> : null}
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  keyboardContainer: {
    width: '100%',
    maxWidth: 520,
    alignItems: 'center',
  },
  dialog: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radii.xl,
    overflow: 'hidden',
    ...Shadows.modal,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  headerTitles: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  title: {
    ...Typography.heading2,
    color: Colors.brandInk,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: Spacing.xxs,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceSecondary,
  },
  body: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
});
