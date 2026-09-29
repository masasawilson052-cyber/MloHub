export type AdminTabId =
  | 'OVERVIEW'
  | 'ORDERS'
  | 'APPLICATIONS'
  | 'RESTAURANTS'
  | 'VERIFICATION'
  | 'REPORTS'
  | 'PAYMENTS'
  | 'REFUNDS'
  | 'SETTLEMENTS'
  | 'ANALYTICS'
  | 'NOTIFICATIONS'
  | 'USERS'
  | 'ADMIN_USERS'
  | 'AUDIT_LOGS'
  | 'HEALTH'
  | 'SETTINGS';

export interface AdminPageQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  restaurantId?: string;
  provider?: string;
  search?: string;
  from?: string;
  to?: string;
}

export interface AdminPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}

export interface AdminFinanceSummary {
  attemptedVolumeTzs: number;
  capturedVolumeTzs: number;
  refundedVolumeTzs: number;

  pendingPayments: number;
  failedPayments: number;

  pendingRefunds: number;
  openDisputes: number;

  calculatedSettlements: number;
  approvedSettlements: number;

  queuedPayouts: number;
  failedPayouts: number;

  settlementGrossTzs: number;
  platformCommissionTzs: number;
  merchantNetPayableTzs: number;
  paidOutTzs: number;
}

export interface AdminActionInboxItem {
  id: string;
  kind: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO';
  title: string;
  detail: string;
  targetTab: AdminTabId;
  entityId: string;
  createdAt: string;
}

export interface AdminOverviewMetrics {
  totalRestaurants: number;
  basicSellers: number;
  verifiedSellers: number;
  suspendedRestaurants: number;

  pendingApplications: number;
  openReports: number;

  totalOrders: number;
  completedOrders: number;

  capturedVolumeTzs: number;
  platformRevenueTzs: number;

  pendingRefunds: number;
  pendingSettlements: number;

  stalePayments: number;
  failedOutbox: number;
}
