-- ==============================================================================
-- MLOHUB MIGRATION: 20260929000200_admin_operations_experience_closure.sql
-- Description: Administrator Final Closure Pass 2 - Operations Experience & Authority
-- 1. get_admin_action_inbox (server-side authoritative action items requiring attention)
-- 2. get_admin_overview_metrics (authoritative platform-wide overview metrics)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SERVER-SIDE ADMIN ACTION INBOX
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_action_inbox(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id TEXT,
  kind TEXT,
  severity TEXT,
  title TEXT,
  detail TEXT,
  target_tab TEXT,
  entity_id TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.require_admin_aal2();

  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION '403 Forbidden: Administrator authorization required.';
  END IF;

  RETURN QUERY
  SELECT *
  FROM (
    -- 1. Restaurant applications requiring review
    SELECT
      'application:' || ra.id::text AS id,
      'RESTAURANT_APPLICATION' AS kind,
      'HIGH' AS severity,
      'Restaurant application requires review' AS title,
      COALESCE(ra.business_name::text, 'Unnamed Merchant') AS detail,
      'APPLICATIONS' AS target_tab,
      ra.id::text AS entity_id,
      ra.created_at AS created_at
    FROM public.restaurant_applications ra
    WHERE ra.status IN ('PENDING', 'SUBMITTED', 'UNDER_REVIEW')

    UNION ALL

    -- 2. Merchant verification documents requiring verification
    SELECT
      'verification_doc:' || rvd.id::text AS id,
      'MERCHANT_VERIFICATION_DOC' AS kind,
      'HIGH' AS severity,
      'Merchant verification document requires review' AS title,
      COALESCE(rvd.document_type || ' (' || COALESCE(rvd.restaurant_id, rvd.application_id, 'No ref') || ')', 'Verification Doc') AS detail,
      'VERIFICATION' AS target_tab,
      rvd.id::text AS entity_id,
      rvd.created_at AS created_at
    FROM public.restaurant_verification_documents rvd
    WHERE rvd.verification_status = 'PENDING'

    -- 3. Merchant payout destinations awaiting verification
    UNION ALL
    SELECT
      'payout_dest:' || mpd.id::text AS id,
      'PAYOUT_DESTINATION_VERIFICATION' AS kind,
      'HIGH' AS severity,
      'Payout destination requires administrator verification' AS title,
      COALESCE(mpd.account_name || ' (' || mpd.masked_account_identifier || ')', 'Payout Destination') AS detail,
      'SETTLEMENTS' AS target_tab,
      mpd.id::text AS entity_id,
      mpd.created_at AS created_at
    FROM public.merchant_payout_destinations mpd
    WHERE mpd.verification_status::text = 'PENDING_VERIFICATION'

    -- 4. Refund requests requiring approval
    UNION ALL
    SELECT
      'refund:' || rr.id::text AS id,
      'REFUND_REQUEST' AS kind,
      'HIGH' AS severity,
      'Refund requires approval' AS title,
      COALESCE(rr.reason_detail, rr.reason_code, 'Refund requested') AS detail,
      'REFUNDS' AS target_tab,
      rr.id::text AS entity_id,
      rr.requested_at AS created_at
    FROM public.refund_requests rr
    WHERE rr.status::text = 'REQUESTED'

    -- 5. Financial disputes requiring attention
    UNION ALL
    SELECT
      'dispute:' || fd.id::text AS id,
      'FINANCIAL_DISPUTE' AS kind,
      'HIGH' AS severity,
      'Financial dispute requires review' AS title,
      COALESCE(fd.description, 'Dispute pending review') AS detail,
      'REFUNDS' AS target_tab,
      fd.id::text AS entity_id,
      fd.opened_at AS created_at
    FROM public.financial_disputes fd
    WHERE fd.status::text IN ('OPEN', 'EVIDENCE_REQUIRED', 'UNDER_REVIEW')

    -- 6. Merchant settlements requiring approval
    UNION ALL
    SELECT
      'settlement:' || ms.id::text AS id,
      'MERCHANT_SETTLEMENT' AS kind,
      'MEDIUM' AS severity,
      'Settlement requires review' AS title,
      COALESCE(ms.reference, ms.id::text) AS detail,
      'SETTLEMENTS' AS target_tab,
      ms.id::text AS entity_id,
      ms.created_at AS created_at
    FROM public.merchant_settlements ms
    WHERE ms.status::text IN ('CALCULATED', 'UNDER_REVIEW')

    -- 7. Failed or reversed merchant payouts
    UNION ALL
    SELECT
      'payout:' || mp.id::text AS id,
      'PAYOUT_FAILURE' AS kind,
      'CRITICAL' AS severity,
      'Merchant payout requires attention' AS title,
      COALESCE(mp.failure_reason, mp.status::text) AS detail,
      'SETTLEMENTS' AS target_tab,
      mp.id::text AS entity_id,
      mp.requested_at AS created_at
    FROM public.merchant_payouts mp
    WHERE mp.status::text IN ('FAILED', 'MANUAL_REVIEW', 'REVERSED')

    -- 8. Stale payments pending gateway capture (> 15 minutes)
    UNION ALL
    SELECT
      'payment:' || p.id AS id,
      'STALE_PAYMENT' AS kind,
      'HIGH' AS severity,
      'Payment requires reconciliation' AS title,
      COALESCE(p.provider_reference, p.id) AS detail,
      'PAYMENTS' AS target_tab,
      p.id AS entity_id,
      p.created_at AS created_at
    FROM public.payments p
    WHERE p.status::text = 'PENDING'
      AND p.created_at < clock_timestamp() - interval '15 minutes'

    -- 9. Notification delivery failures
    UNION ALL
    SELECT
      'outbox:' || o.id::text AS id,
      'NOTIFICATION_FAILURE' AS kind,
      CASE
        WHEN o.processing_status = 'DEAD_LETTER' THEN 'CRITICAL'
        ELSE 'HIGH'
      END AS severity,
      'Notification delivery requires attention' AS title,
      COALESCE(o.last_error, o.processing_status) AS detail,
      'HEALTH' AS target_tab,
      o.id::text AS entity_id,
      o.created_at AS created_at
    FROM public.notification_event_outbox o
    WHERE o.processing_status IN ('FAILED', 'DEAD_LETTER')

    -- 10. Security events in last 24h
    UNION ALL
    SELECT
      'security:' || se.id::text AS id,
      'SECURITY_EVENT' AS kind,
      'CRITICAL' AS severity,
      'Security event requires administrator review' AS title,
      se.event_type AS detail,
      'HEALTH' AS target_tab,
      se.id::text AS entity_id,
      se.created_at AS created_at
    FROM public.security_events se
    WHERE se.severity IN ('HIGH', 'CRITICAL')
      AND se.created_at >= clock_timestamp() - interval '24 hours'

    -- 11. System worker heartbeats unhealthy or stale (> 15 minutes)
    UNION ALL
    SELECT
      'worker:' || swh.worker_name AS id,
      'WORKER_HEARTBEAT_ALERT' AS kind,
      'CRITICAL' AS severity,
      'Background worker unhealthy or stale' AS title,
      swh.worker_name || ' (status: ' || swh.status || ')' AS detail,
      'HEALTH' AS target_tab,
      swh.worker_name AS entity_id,
      swh.last_heartbeat AS created_at
    FROM public.system_worker_heartbeats swh
    WHERE swh.status <> 'HEALTHY'
       OR swh.last_heartbeat < clock_timestamp() - interval '15 minutes'
  ) inbox
  ORDER BY
    CASE severity
      WHEN 'CRITICAL' THEN 1
      WHEN 'HIGH' THEN 2
      WHEN 'MEDIUM' THEN 3
      ELSE 4
    END,
    created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_action_inbox(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_action_inbox(INTEGER) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. TRUE ADMIN OVERVIEW METRICS RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_overview_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_metrics JSONB;
BEGIN
  PERFORM public.require_admin_aal2();

  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION '403 Forbidden: Administrator authorization required.';
  END IF;

  SELECT jsonb_build_object(
    'total_restaurants',
    (SELECT COUNT(*) FROM public.restaurants),

    'basic_sellers',
    (SELECT COUNT(*) FROM public.restaurants WHERE seller_tier::text = 'BASIC_SELLER' AND is_suspended = FALSE),

    'verified_sellers',
    (SELECT COUNT(*) FROM public.restaurants WHERE seller_tier::text IN ('VERIFIED_RESTAURANT', 'VERIFIED_SELLER') AND is_suspended = FALSE),

    'suspended_restaurants',
    (SELECT COUNT(*) FROM public.restaurants WHERE is_suspended = TRUE OR verification_status::text = 'SUSPENDED'),

    'pending_applications',
    (SELECT COUNT(*) FROM public.restaurant_applications WHERE status = 'PENDING'),

    'open_reports',
    (SELECT COUNT(*) FROM public.data_reports WHERE status = 'OPEN'),

    'total_orders',
    (SELECT COUNT(*) FROM public.orders),

    'completed_orders',
    (SELECT COUNT(*) FROM public.orders WHERE status = 'COMPLETED'),

    'captured_volume_tzs',
    COALESCE((
      SELECT SUM(amount_tzs)
      FROM public.payments
      WHERE status::text IN ('SUCCESS', 'CAPTURED', 'PAID')
    ), 0),

    'platform_revenue_tzs',
    COALESCE((
      SELECT SUM(platform_commission_tzs)
      FROM public.payments
      WHERE status::text IN ('SUCCESS', 'CAPTURED', 'PAID')
    ), 0),

    'pending_refunds',
    (SELECT COUNT(*) FROM public.refund_requests WHERE status::text = 'REQUESTED'),

    'pending_settlements',
    (SELECT COUNT(*) FROM public.merchant_settlements WHERE status::text IN ('CALCULATED', 'UNDER_REVIEW')),

    'stale_payments',
    (SELECT COUNT(*) FROM public.payments WHERE status::text = 'PENDING' AND created_at < clock_timestamp() - interval '15 minutes'),

    'failed_outbox',
    (SELECT COUNT(*) FROM public.notification_event_outbox WHERE processing_status IN ('FAILED', 'DEAD_LETTER'))
  )
  INTO v_metrics;

  RETURN v_metrics;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_overview_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_overview_metrics() TO authenticated, service_role;
