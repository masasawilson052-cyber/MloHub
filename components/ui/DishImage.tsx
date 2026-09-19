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
              StyleSheet.absoluteFillObject,
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
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: Colors.surfaceSecondary,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryMuted,
  },
  fallbackEmoji: {
    fontSize: 40,
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 246, 244, 0.6)',
  },
});
