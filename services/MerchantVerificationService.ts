import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  RestaurantVerificationDocument,
  VerificationDocumentType,
  DocumentVerificationStatus,
} from '../types/domain';

// Lazy load ImagePicker to allow isomorphic execution in Node.js test runners
let imagePickerModule: any = null;
function getImagePicker(): any {
  if (!imagePickerModule) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      imagePickerModule = require('expo-image-picker');
    } catch {
      imagePickerModule = null;
    }
  }
  return imagePickerModule;
}

export const VERIFICATION_BUCKET = 'merchant-verification';

export const ALLOWED_VERIFICATION_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export const MAX_VERIFICATION_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Uploads a legal or operational verification document into the PRIVATE 'merchant-verification' bucket.
 * 
 * SECURITY COMPLIANCE:
 * - Documents are NEVER stored in public buckets (e.g. mlohub-media).
 * - ZERO public URLs are generated or returned.
 * - Access requires authenticated ownership or administrator AAL2 clearance.
 */
export async function uploadVerificationDocument(params: {
  userId: string;
  applicationId: string;
  documentType: VerificationDocumentType | string;
  uri: string;
  mimeType: string;
}): Promise<{ path: string }> {
  const ext = params.mimeType.includes('png')
    ? 'png'
    : params.mimeType.includes('pdf')
    ? 'pdf'
    : 'jpg';

  const path = `${params.userId}/${params.applicationId}/${params.documentType}/${generateUuid()}.${ext}`;

  if (!isSupabaseConfigured()) {
    // Return simulated path for mock/offline testing
    return { path };
  }

  const file = await fetch(params.uri).then((res) => res.arrayBuffer());

  const { data, error } = await supabase.storage
    .from(VERIFICATION_BUCKET)
    .upload(path, file, {
      contentType: params.mimeType,
      upsert: false,
    });

  if (error) {
    console.error('[MerchantVerificationService] Storage upload error:', error.message);
    throw error;
  }

  return {
    path: data.path,
  };
}

/**
 * Persists metadata record in public.restaurant_verification_documents table
 */
export async function recordVerificationDocument(params: {
  applicationId?: string;
  restaurantId?: string;
  ownerUserId: string;
  documentType: VerificationDocumentType;
  storagePath: string;
}): Promise<RestaurantVerificationDocument> {
  const row = {
    application_id: params.applicationId || null,
    restaurant_id: params.restaurantId || null,
    owner_user_id: params.ownerUserId,
    document_type: params.documentType,
    storage_path: params.storagePath,
    verification_status: 'PENDING',
  };

  if (!isSupabaseConfigured()) {
    return {
      id: `doc_${Date.now()}`,
      applicationId: params.applicationId,
      restaurantId: params.restaurantId,
      ownerUserId: params.ownerUserId,
      documentType: params.documentType,
      storagePath: params.storagePath,
      verificationStatus: 'PENDING',
      createdAt: new Date().toISOString(),
    };
  }

  const { data, error } = await supabase
    .from('restaurant_verification_documents')
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('[MerchantVerificationService] Record insert error:', error.message);
    throw new Error(`Failed to record verification document: ${error.message}`);
  }

  return {
    id: data.id,
    applicationId: data.application_id,
    restaurantId: data.restaurant_id,
    ownerUserId: data.owner_user_id,
    documentType: data.document_type as VerificationDocumentType,
    storagePath: data.storage_path,
    verificationStatus: data.verification_status as DocumentVerificationStatus,
    rejectionReason: data.rejection_reason,
    createdAt: data.created_at,
    reviewedAt: data.reviewed_at,
    reviewedBy: data.reviewed_by,
  };
}

/**
 * Lists all verification documents attached to a given application
 */
export async function listDocumentsForApplication(
  applicationId: string
): Promise<RestaurantVerificationDocument[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('restaurant_verification_documents')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[MerchantVerificationService] listDocuments error:', error.message);
    throw new Error(`Failed to list application documents: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    applicationId: row.application_id,
    restaurantId: row.restaurant_id,
    ownerUserId: row.owner_user_id,
    documentType: row.document_type as VerificationDocumentType,
    storagePath: row.storage_path,
    verificationStatus: row.verification_status as DocumentVerificationStatus,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
  }));
}

/**
 * Lists all verification documents attached to a restaurant tenant
 */
export async function listDocumentsForRestaurant(
  restaurantId: string
): Promise<RestaurantVerificationDocument[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('restaurant_verification_documents')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[MerchantVerificationService] listRestaurantDocs error:', error.message);
    throw new Error(`Failed to list restaurant documents: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    applicationId: row.application_id,
    restaurantId: row.restaurant_id,
    ownerUserId: row.owner_user_id,
    documentType: row.document_type as VerificationDocumentType,
    storagePath: row.storage_path,
    verificationStatus: row.verification_status as DocumentVerificationStatus,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
  }));
}

/**
 * Creates a short-lived presigned URL (15 minutes) for private document inspection.
 * Never creates permanent or public links.
 */
export async function createTemporaryDocumentAccessUrl(
  storagePath: string,
  expiresInSeconds = 900
): Promise<string> {
  if (!isSupabaseConfigured()) {
    return `https://storage.local.simulated/${storagePath}`;
  }

  const { data, error } = await supabase.storage
    .from(VERIFICATION_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to generate signed document URL: ${error?.message || 'Unknown error'}`);
  }

  return data.signedUrl;
}

/**
 * Image picker helper for picking verification documents
 */
export async function pickVerificationDocument(): Promise<{
  uri: string;
  mimeType: string;
  fileName?: string;
} | null> {
  const picker = getImagePicker();
  if (!picker) {
    throw new Error('Image picker is not available on this platform.');
  }

  const res = await picker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.85,
  });

  if (res.canceled || !res.assets || res.assets.length === 0) {
    return null;
  }

  const asset = res.assets[0];
  const mimeType = asset.mimeType || (asset.uri.endsWith('.png') ? 'image/png' : 'image/jpeg');

  return {
    uri: asset.uri,
    mimeType,
    fileName: asset.fileName || 'verification_doc',
  };
}
