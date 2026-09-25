import React, { useState } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  StyleProp,
  ImageStyle,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Radii } from '../../theme/radius';

import { useTheme } from '../../context/ThemeContext';
import { ThemeColors, lightColors } from '../../theme/palettes';

let colors: ThemeColors = lightColors;

export interface DishImageProps {
  uri?: string | null;
  aspectRatio?: number;
  height?: number;
  width?: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  fallbackEmoji?: string;
  borderRadius?: number;
}

export const DishImage: React.FC<DishImageProps> = ({
  uri,
  aspectRatio = 16 / 9,
  height,
  width = '100%',
  style,
  imageStyle,
  fallbackEmoji = '🍲',
  borderRadius = Radii.md,
}) => {
  const { colors: _tc } = useTheme(); colors = _tc; styles = createStyles(colors);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(uri));

  const showFallback = !uri || hasError;

  return (
    <View
      style={[
        styles.container,
        {
          width: width as any,
          height: height,
          aspectRatio: height ? undefined : aspectRatio,
          borderRadius,
        },
        style,
      ]}
    >
      {showFallback ? (
        <View style={[styles.fallbackContainer, { borderRadius }]}>
          <Text style={styles.fallbackEmoji}>{fallbackEmoji}</Text>
        </View>
      ) : (
        <>
          <Image
            source={{ uri }}
            style={[
              StyleSheet.absoluteFill,
              styles.image,
              { borderRadius },
              imageStyle,
            ]}
            resizeMode="cover"
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
          />
          {isLoading ? (
            <View style={[styles.loaderContainer, { borderRadius }]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceInteractive,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  fallbackEmoji: {
    fontSize: 40,
  },
  loaderContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 246, 244, 0.6)',
  },
});
let styles = createStyles(lightColors);
