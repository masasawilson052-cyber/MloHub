import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radii } from '../../theme/radius';
import { Shadows } from '../../theme/shadows';
import { Typography } from '../../theme/typography';
import { Review, ReviewResponse } from '../../types/domain';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';

export interface ExtendedReview extends Omit<Review, 'response'> {
  customerName?: string;
  response?: string | ReviewResponse;
  respondedAt?: string;
}

export interface ReviewsPanelProps {
  reviews: ExtendedReview[];
  averageRating: number;
  onRespondToReview: (reviewId: string, responseText: string) => Promise<void>;
  language?: 'en' | 'sw';
}

export const ReviewsPanel: React.FC<ReviewsPanelProps> = ({
  reviews,
  averageRating,
  onRespondToReview,
  language = 'en',
}) => {
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitReply = async (reviewId: string) => {
    if (!replyText.trim()) return;
    try {
      setIsSubmitting(true);
      await onRespondToReview(reviewId, replyText.trim());
      setActiveReplyId(null);
      setReplyText('');
      Alert.alert(
        language === 'sw' ? 'Jibu Limetumwa!' : 'Response Published!',
        language === 'sw'
          ? 'Jibu lako litaonekana hadharani chini ya maoni ya mteja.'
          : 'Your response is now visible publicly under the customer review.'
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to submit response.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Reputation Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.ratingScoreCol}>
          <Text style={styles.bigRatingText}>{averageRating.toFixed(1)}</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= Math.round(averageRating) ? 'star' : 'star-outline'}
                size={18}
                color="#EAB308"
              />
            ))}
          </View>
          <Text style={styles.totalReviewsSub}>
            {reviews.length} {language === 'sw' ? 'maoni yaliyothibitishwa' : 'verified diner reviews'}
          </Text>
        </View>

        <View style={styles.dimensionsCol}>
          <View style={styles.dimensionRow}>
            <Text style={styles.dimensionLabel}>Food Quality</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '96%' }]} />
            </View>
            <Text style={styles.dimensionScore}>4.8</Text>
          </View>

          <View style={styles.dimensionRow}>
            <Text style={styles.dimensionLabel}>Value for Money</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '92%' }]} />
            </View>
            <Text style={styles.dimensionScore}>4.6</Text>
          </View>

          <View style={styles.dimensionRow}>
            <Text style={styles.dimensionLabel}>Kitchen Speed</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '90%' }]} />
            </View>
            <Text style={styles.dimensionScore}>4.5</Text>
          </View>
        </View>
      </View>

      {/* Reviews List */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.reviewsList}>
        {reviews.length === 0 ? (
          <EmptyState
            title="No Reviews Yet"
            message="Verified diners who complete an order can leave feedback and ratings here."
            icon="star-outline"
          />
        ) : (
          reviews.map((rev) => (
            <View key={rev.id} style={styles.reviewCard}>
              <View style={styles.reviewTop}>
                <View>
                  <Text style={styles.reviewerName}>{rev.customerName || 'Verified Diner'}</Text>
                  <View style={styles.verifiedTag}>
                    <Ionicons name="shield-checkmark" size={11} color={Colors.primary} />
                    <Text style={styles.verifiedTagText}>Completed Order Verified</Text>
                  </View>
                </View>

                <View style={styles.ratingStars}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons
                      key={s}
                      name={s <= (rev.overallRating || (rev as any).rating || 5) ? 'star' : 'star-outline'}
                      size={14}
                      color="#EAB308"
                    />
                  ))}
                </View>
              </View>

              <Text style={styles.commentText}>{rev.comment}</Text>
              <Text style={styles.reviewDate}>
                {new Date(rev.createdAt).toLocaleDateString()}
              </Text>

              {/* Existing Restaurant Response */}
              {!!rev.response && (
                <View style={styles.responseBubble}>
                  <View style={styles.responseHeader}>
                    <Ionicons name="return-down-forward" size={14} color={Colors.primaryDark} />
                    <Text style={styles.responseAuthor}>Restaurant Response</Text>
                    {(rev.respondedAt || (typeof rev.response === 'object' && (rev.response as ReviewResponse)?.createdAt)) && (
                      <Text style={styles.responseDate}>
                        • {new Date(rev.respondedAt || (rev.response as ReviewResponse).createdAt).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.responseText}>
                    {typeof rev.response === 'string' ? rev.response : (rev.response as ReviewResponse)?.body}
                  </Text>
                </View>
              )}

              {/* Reply Button or Reply Input Form */}
              {!rev.response && (
                <View style={styles.replySection}>
                  {activeReplyId === rev.id ? (
                    <View style={styles.replyInputBox}>
                      <TextInput
                        style={styles.replyInput}
                        placeholder={
                          language === 'sw'
                            ? 'Andika jibu rasmi kwa mteja...'
                            : 'Write an official response to this diner...'
                        }
                        value={replyText}
                        onChangeText={setReplyText}
                        multiline
                      />
                      <View style={styles.replyButtonsRow}>
                        <Button
                          title="Cancel"
                          onPress={() => {
                            setActiveReplyId(null);
                            setReplyText('');
                          }}
                          variant="ghost"
                          size="sm"
                        />
                        <Button
                          title={isSubmitting ? 'Posting...' : 'Publish Response'}
                          onPress={() => handleSubmitReply(rev.id)}
                          loading={isSubmitting}
                          variant="primary"
                          size="sm"
                        />
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.openReplyBtn}
                      onPress={() => {
                        setActiveReplyId(rev.id);
                        setReplyText('');
                      }}
                    >
                      <Ionicons name="chatbubble-outline" size={14} color={Colors.primary} />
                      <Text style={styles.openReplyBtnText}>
                        {language === 'sw' ? 'Jibu Maoni Haya' : 'Respond to Diner'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
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
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    flexWrap: 'wrap',
    gap: Spacing.lg,
    ...Shadows.sm,
  },
  ratingScoreCol: {
    alignItems: 'center',
    minWidth: 140,
  },
  bigRatingText: {
    ...Typography.Display,
    fontSize: 40,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
    marginVertical: 4,
  },
  totalReviewsSub: {
    ...Typography.Caption,
    color: Colors.textMuted,
  },
  dimensionsCol: {
    flex: 1,
    minWidth: 240,
    gap: 8,
  },
  dimensionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dimensionLabel: {
    ...Typography.Caption,
    color: Colors.textSecondary,
    width: 100,
    fontWeight: '600',
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  dimensionScore: {
    ...Typography.Caption,
    fontWeight: '700',
    color: Colors.textPrimary,
    width: 25,
    textAlign: 'right',
  },
  reviewsList: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  reviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  reviewerName: {
    ...Typography.BodyMedium,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  verifiedTagText: {
    ...Typography.Caption,
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '600',
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 2,
  },
  commentText: {
    ...Typography.Body,
    color: Colors.textPrimary,
    marginVertical: 6,
    lineHeight: 20,
  },
  reviewDate: {
    ...Typography.Caption,
    color: Colors.textMuted,
    fontSize: 11,
  },
  responseBubble: {
    backgroundColor: Colors.surfaceSecondary,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    padding: Spacing.sm,
    borderRadius: Radii.sm,
    marginTop: Spacing.sm,
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  responseAuthor: {
    ...Typography.Caption,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  responseDate: {
    ...Typography.Caption,
    color: Colors.textMuted,
    fontSize: 10,
  },
  responseText: {
    ...Typography.Body,
    color: Colors.textPrimary,
    fontSize: 13,
  },
  replySection: {
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.xs,
  },
  openReplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  openReplyBtnText: {
    ...Typography.Caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  replyInputBox: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  replyInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    ...Typography.Body,
    fontSize: 13,
    minHeight: 60,
    backgroundColor: Colors.white,
  },
  replyButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
  },
});
