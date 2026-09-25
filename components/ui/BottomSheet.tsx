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
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Typography } from '../../theme/typography';
import { Shadows } from '../../theme/shadows';
import { useTheme } from '../../context/ThemeContext';

import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  maxHeightRatio?: number;
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
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);

  return (
    <RNModal
      visible={visible}
      transparent={true}
      animationType={isDesktop ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View
          style={[
            styles.backdrop,
            { backgroundColor: colors.modalBackdrop },
            isDesktop ? styles.desktopBackdrop : styles.mobileBackdrop,
          ]}
        >
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View
              style={[
                styles.sheetContainer,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.borderStrong,
                },
                isDesktop ? styles.desktopContainer : styles.mobileContainer,
                { maxHeight },
                style,
              ]}
            >
              {!isDesktop && showHandle ? (
                <View style={styles.handleContainer}>
                  <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
                </View>
              ) : null}

              {title ? (
                <View style={[styles.header, { borderBottomColor: colors.divider }]}>
                  <View style={styles.headerTitles}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
                    {subtitle ? (
                      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={onClose}
                    style={[styles.closeBtn, { backgroundColor: colors.surfaceInteractive }]}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Close bottom sheet"
                  >
                    <Ionicons name="close" size={22} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              ) : null}

              <ScrollView
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>

              {footer ? (
                <View style={[styles.footer, { borderTopColor: colors.divider }]}>{footer}</View>
              ) : null}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
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
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
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
  },
});
let styles = createStyles(lightColors);
