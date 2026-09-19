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
  Platform,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';
import { Shadows } from '../../theme/shadows';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  maxHeightRatio?: number; // default 0.85
  showHandle?: boolean;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  style,
  maxHeightRatio = 0.85,
  showHandle = true,
}) => {
  const { height, width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const maxHeight = height * maxHeightRatio;

  return (
    <RNModal
      visible={visible}
      transparent={true}
      animationType={isDesktop ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.backdrop, isDesktop ? styles.desktopBackdrop : styles.mobileBackdrop]}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View
              style={[
                styles.sheetContainer,
                isDesktop ? styles.desktopContainer : styles.mobileContainer,
                { maxHeight },
                style,
              ]}
            >
              {/* Drag handle for mobile */}
              {!isDesktop && showHandle ? (
                <View style={styles.handleContainer}>
                  <View style={styles.handle} />
                </View>
              ) : null}

              {/* Header */}
              {title ? (
                <View style={styles.header}>
                  <View style={styles.headerTitles}>
                    <Text style={styles.title}>{title}</Text>
                    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                  </View>
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeBtn}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Close bottom sheet"
                  >
                    <Ionicons name="close" size={22} color={Colors.brandInk} />
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Scrollable Body */}
              <ScrollView
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>

              {/* Footer */}
              {footer ? <View style={styles.footer}>{footer}</View> : null}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
  },
  mobileBackdrop: {
    justifyContent: 'flex-end',
  },
  desktopBackdrop: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  sheetContainer: {
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    ...Shadows.modal,
  },
  mobileContainer: {
    width: '100%',
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    paddingBottom: Platform.OS === 'ios' ? 24 : Spacing.md,
  },
  desktopContainer: {
    width: '100%',
    maxWidth: 580,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
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
    flexGrow: 0,
  },
  bodyContent: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
});
