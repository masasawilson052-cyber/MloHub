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
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';
import { Shadows } from '../../theme/shadows';
import { useTheme } from '../../context/ThemeContext';

import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

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
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);

  return (
    <RNModal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.backdrop, { backgroundColor: colors.modalBackdrop }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardContainer}
          >
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View
                style={[
                  styles.dialog,
                  {
                    backgroundColor: colors.surfaceRaised,
                    borderColor: colors.borderStrong,
                  },
                  style,
                ]}
              >
                {title || showCloseButton ? (
                  <View style={styles.header}>
                    <View style={styles.headerTitles}>
                      {title ? (
                        <Text style={[styles.title, { color: colors.textPrimary }]}>
                          {title}
                        </Text>
                      ) : null}
                      {subtitle ? (
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                          {subtitle}
                        </Text>
                      ) : null}
                    </View>
                    {showCloseButton ? (
                      <TouchableOpacity
                        onPress={onClose}
                        style={[styles.closeBtn, { backgroundColor: colors.surfaceInteractive }]}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel="Close dialog"
                      >
                        <Ionicons name="close" size={22} color={colors.textPrimary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}

                <View style={[styles.body, contentStyle]}>{children}</View>

                {footer ? (
                  <View style={[styles.footer, { borderTopColor: colors.divider }]}>
                    {footer}
                  </View>
                ) : null}
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
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
    borderRadius: Radii.xl,
    overflow: 'hidden',
    ...Shadows.modal,
    borderWidth: 1,
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
  },
  subtitle: {
    ...Typography.bodySmall,
    marginTop: 2,
  },
  closeBtn: {
    padding: Spacing.xxs,
    borderRadius: Radii.full,
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
  },
});
let styles = createStyles(lightColors);
