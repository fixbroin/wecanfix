
import type { Icon as LucideIconType } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';

export interface FirestoreCategory {
  id: string; // Firestore document ID
  name: string;
  slug: string;
  order: number;
  imageUrl?: string;
  imageHint?: string;
  h1_title?: string; // SEO: H1 title for the category page
  seo_title?: string; // SEO: Meta title for the category page
  seo_description?: string; // SEO: Meta description
  seo_keywords?: string; // SEO: Meta keywords (comma-separated)
  createdAt?: Timestamp;
}

export interface FirestoreSubCategory {
  id: string; // Firestore document ID
  parentId: string; // ID of the parent FirestoreCategory
  name: string;
  slug: string;
  order: number;
  imageUrl?: string;
  imageHint?: string;
  h1_title?: string; // SEO: H1 title if a dedicated sub-category page exists
  seo_title?: string; // SEO: Meta title
  seo_description?: string; // SEO: Meta description
  seo_keywords?: string; // SEO: Meta keywords
  createdAt?: Timestamp;
}

export interface FirestoreService {
  id: string; // Firestore document ID
  subCategoryId: string; // ID of the parent FirestoreSubCategory
  name: string;
  slug: string;
  description: string; // Short description for cards
  price: number; // This is the DISPLAYED price (can be inclusive or exclusive of tax)
  isTaxInclusive?: boolean; // True if the 'price' field already includes tax
  discountedPrice?: number; // This is also DISPLAYED price
  rating: number; // Default rating, can be an aggregate
  reviewCount?: number;
  imageUrl?: string; // Main image for the service detail page
  imageHint?: string; // AI hint for the main image
  isActive: boolean;
  shortDescription?: string; // Could be same as description or a slightly longer version
  fullDescription?: string; // Detailed description for service page
  serviceHighlights?: string[]; // New field for "Why choose this service?" points
  taxId?: string; // ID of the selected tax from adminTaxes
  taxName?: string; // Denormalized tax name
  taxPercent?: number; // Denormalized tax percentage
  h1_title?: string; // SEO: H1 title for the service page
  seo_title?: string; // SEO: Meta title for the service page
  seo_description?: string; // SEO: Meta description
  seo_keywords?: string; // SEO: Meta keywords (comma-separated)
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Client-safe version of FirestoreService with serialized dates
export interface ClientServiceData extends Omit<FirestoreService, 'createdAt' | 'updatedAt'> {
  createdAt?: string; // ISO string
  updatedAt?: string; // ISO string
  parentCategoryName?: string; // Added for breadcrumbs
  parentCategorySlug?: string; // Added for breadcrumbs
}


export type BookingStatus = "Pending Payment" | "Confirmed" | "Processing" | "Completed" | "Cancelled" | "Rescheduled";

export interface BookingServiceItem {
  serviceId: string;
  name: string;
  quantity: number;
  pricePerUnit: number; // DISPLAYED pricePerUnit at the time of booking
  discountedPricePerUnit?: number; // DISPLAYED discountedPricePerUnit
  isTaxInclusive?: boolean; // Was the pricePerUnit tax inclusive at booking?
  taxPercentApplied?: number; // Tax percent applied to this item's base price
  taxAmountForItem?: number; // Calculated tax amount for this item (based on its base price)
}

export interface AppliedPlatformFeeItem {
  name: string;
  type: 'percentage' | 'fixed';
  valueApplied: number; // The original value (e.g., 10 for 10% or 50 for ₹50)
  calculatedFeeAmount: number; // Base amount of the fee calculated
  taxRatePercentOnFee: number; // Tax rate APPLIED TO THIS FEE's value (e.g., 18 for 18% tax on the fee amount). 0 if no tax.
  taxAmountOnFee: number; // Tax calculated on this fee
}

export interface FirestoreBooking {
  id?: string; // Firestore document ID (optional before creation)
  bookingId: string; // User-friendly booking ID (e.g., FIXBRO-TIMESTAMP-RANDOM)
  userId?: string; // If user is logged in
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  scheduledDate: string; // Store as ISO string or a user-friendly format
  scheduledTimeSlot: string;
  services: BookingServiceItem[];
  subTotal: number; // Sum of BASE prices of all services (price before individual item tax)
  visitingCharge?: number; // BASE visiting charge (amount before its own tax)
  taxAmount: number; // Total tax for the booking (sum of item taxes + tax on visiting charge + tax on platform fees)
  totalAmount: number; // Grand total: (subTotal + visitingCharge - discountAmount + sum(platformFeeBase) + sum(platformFeeTax)) + totalItemAndVCTax
  discountCode?: string;
  discountAmount?: number; // Discount applied to the sum of BASE prices + BASE visiting charge
  paymentMethod: string;
  paymentId?: string; // If online payment
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  razorpaySignature?: string;
  status: BookingStatus;
  notes?: string; // Any special instructions from customer
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  appliedPlatformFees?: AppliedPlatformFeeItem[]; // Store applied platform fees
  isReviewedByCustomer?: boolean; // New field
  cancellationFeePaid?: number; // New field for paid cancellation fee amount
  cancellationPaymentId?: string; // New field for cancellation fee payment ID
}

export interface FirestoreUser {
  id: string; // Firestore document ID, should be same as Firebase Auth UID
  uid: string;
  email: string | null;
  displayName: string | null;
  mobileNumber?: string | null;
  photoURL?: string | null; // Optional, if you store it
  isActive: boolean; // To enable/disable user access
  roles?: string[]; // For role-based access control, e.g., ['admin', 'customer']
  fcmTokens?: { [token: string]: Timestamp }; // For storing FCM device tokens
  createdAt: Timestamp;
  lastLoginAt?: Timestamp;
}

export type SlideButtonLinkType = 'category' | 'subcategory' | 'service' | 'url' | null;

export interface FirestoreSlide {
  id: string; // Firestore document ID
  title?: string;
  description?: string;
  imageUrl: string;
  imageHint?: string;
  order: number;
  buttonText?: string;
  buttonLinkType?: SlideButtonLinkType;
  buttonLinkValue?: string | null;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// Theme Palette Definition
export interface ThemePalette {
  background: string;
  foreground: string;
  card: string;
  'card-foreground': string;
  popover: string;
  'popover-foreground': string;
  primary: string;
  'primary-foreground': string;
  secondary: string;
  'secondary-foreground': string;
  muted: string;
  'muted-foreground': string;
  accent: string;
  'accent-foreground': string;
  destructive: string;
  'destructive-foreground': string;
  border: string;
  input: string;
  ring: string;
  'chart-1': string;
  'chart-2': string;
  'chart-3': string;
  'chart-4': string;
  'chart-5': string;
  'sidebar-background': string;
  'sidebar-foreground': string;
  'sidebar-primary': string;
  'sidebar-primary-foreground': string;
  'sidebar-accent': string;
  'sidebar-accent-foreground': string;
  'sidebar-border': string;
  'sidebar-ring': string;
}

// Updated Theme Colors Type
export interface ThemeColors {
  light?: Partial<ThemePalette>;
  dark?: Partial<ThemePalette>;
}

export interface GlobalAdminPopup {
  message: string;
  isActive: boolean;
  durationSeconds?: number; // How long the popup stays on screen
  sentAt?: Timestamp; // When it was last sent/activated
}

// New types for Web Settings
export interface GlobalWebSettings {
  id?: string; // Should be "global"
  websiteName?: string;
  contactEmail?: string;
  contactMobile?: string;
  address?: string;
  logoUrl?: string;
  logoImageHint?: string;
  faviconUrl?: string;
  websiteIconUrl?: string; // Larger icon, e.g., for PWA or social sharing
  websiteIconImageHint?: string;
  socialMediaLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
  };
  themeColors?: ThemeColors;
  isChatEnabled?: boolean; // Moved from AppSettings to GlobalWebSettings
  chatNotificationSoundUrl?: string; // Moved from AppSettings
  globalAdminPopup?: GlobalAdminPopup;
  updatedAt?: Timestamp;
}

export interface ContentPage {
  id: string; // Firestore document ID, can be same as slug
  slug: string; // e.g., "about-us", "terms-of-service"
  title: string; // e.g., "About Us"
  content: string; // HTML or Markdown content
  updatedAt: Timestamp;
}

export interface FirestoreFAQ {
  id: string; // Firestore document ID
  question: string;
  answer: string;
  order: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export type ReviewStatus = "Pending" | "Approved" | "Rejected" | "Flagged";

export interface FirestoreReview {
  id: string; // Firestore document ID
  serviceId: string;
  serviceName: string; // Denormalized
  userId?: string; // Optional, if it's from a logged-in user
  userName: string; // Reviewer's name (can be 'Admin' or actual user name)
  userAvatarUrl?: string; // Optional
  rating: number; // e.g., 1-5
  comment: string;
  status: ReviewStatus;
  isFeatured?: boolean; // Optional, to highlight
  adminCreated: boolean; // true if admin created, false if from customer (for future)
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  bookingId?: string; // New field
}

// New Type for Time Slot Category Limits
export interface TimeSlotCategoryLimit {
  id: string; // Firestore document ID (will be the categoryId)
  categoryId: string;
  categoryName: string; // Denormalized for easier display in admin
  maxConcurrentBookings: number; // Max bookings allowed for this category in a single time slot
  updatedAt: Timestamp;
}

// New Type for Promo Codes
export type DiscountType = "percentage" | "fixed";

export interface FirestorePromoCode {
  id: string; // Firestore document ID
  code: string; // The promo code string (e.g., "SUMMER20")
  description?: string; // Optional description for admin reference
  discountType: DiscountType;
  discountValue: number; // If percentage, 1-100. If fixed, monetary value.
  minBookingAmount?: number; // Optional minimum booking amount for the code to apply
  maxUses?: number; // Optional total number of times this code can be used
  usesCount: number; // How many times this code has been used
  validFrom?: Timestamp; // Optional start date of validity
  validUntil?: Timestamp; // Optional end date of validity
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// Platform Fee Setting Type
export interface PlatformFeeSetting {
  id: string; // Unique ID for React key purposes, generated client-side
  name: string;
  type: 'percentage' | 'fixed'; // Percentage of item subtotal, or fixed amount
  value: number; // The percentage (e.g., 10 for 10%) or fixed amount (e.g., 50 for ₹50)
  feeTaxRatePercent: number; // Tax rate APPLIED TO THIS FEE's value (e.g., 18 for 18% tax on the fee amount). 0 if no tax.
  isActive: boolean;
}

// Application Settings Type
export interface TimePeriodConfig {
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
}

export interface AppSettings {
  // General
  enableMinimumBookingPolicy: boolean;
  minimumBookingAmount: number;
  visitingChargeAmount: number; // This is DISPLAYED visiting charge
  isVisitingChargeTaxInclusive?: boolean; // True if visitingChargeAmount includes tax
  minimumBookingPolicyDescription: string;
  googleMapsApiKey: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  senderEmail: string;
  enableHeroCarousel: boolean;
  enableCarouselAutoplay: boolean;
  carouselAutoplayDelay: number;
  enableTaxOnVisitingCharge: boolean;
  visitingChargeTaxPercent: number;
  // Payment
  enableOnlinePayment: boolean;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  enableCOD: boolean; // Represents "Pay After Service"
  // Time Slots
  timeSlotSettings: {
    morning: TimePeriodConfig;
    afternoon: TimePeriodConfig;
    evening: TimePeriodConfig;
    slotIntervalMinutes: number;
  };
  enableLimitLateBookings: boolean;
  limitLateBookingHours: number;
  // Platform Fees
  platformFees?: PlatformFeeSetting[];
  // Cancellation Policy
  enableCancellationPolicy: boolean;
  freeCancellationDays?: number;
  freeCancellationHours?: number;
  freeCancellationMinutes?: number;
  cancellationFeeType?: 'fixed' | 'percentage';
  cancellationFeeValue?: number;

  updatedAt?: Timestamp; // For tracking updates in Firestore
}

// SEO Settings Type
export interface StructuredDataSocialProfiles {
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
}
export interface FirestoreSEOSettings {
  id?: string; // Should be "global"
  // Global & Homepage
  siteName?: string; // For OG, etc.
  defaultMetaTitleSuffix?: string;
  defaultMetaDescription?: string;
  defaultMetaKeywords?: string; // comma-separated

  homepageMetaTitle?: string;
  homepageMetaDescription?: string;
  homepageMetaKeywords?: string;
  homepageH1?: string;

  // Dynamic Page Patterns (using {{placeholder}})
  categoryPageTitlePattern?: string;
  categoryPageDescriptionPattern?: string;
  categoryPageKeywordsPattern?: string;
  categoryPageH1Pattern?: string;

  cityCategoryPageTitlePattern?: string;
  cityCategoryPageDescriptionPattern?: string;
  cityCategoryPageKeywordsPattern?: string;
  cityCategoryPageH1Pattern?: string;

  areaCategoryPageTitlePattern?: string;
  areaCategoryPageDescriptionPattern?: string;
  areaCategoryPageKeywordsPattern?: string;
  areaCategoryPageH1Pattern?: string;

  servicePageTitlePattern?: string;
  servicePageDescriptionPattern?: string;
  servicePageKeywordsPattern?: string;
  servicePageH1Pattern?: string;

  areaPageTitlePattern?: string;
  areaPageDescriptionPattern?: string;
  areaPageKeywordsPattern?: string;
  areaPageH1Pattern?: string;

  // Structured Data (LocalBusiness default)
  structuredDataType?: string; // e.g., "LocalBusiness", "Organization"
  structuredDataName?: string;
  structuredDataStreetAddress?: string;
  structuredDataLocality?: string; // City
  structuredDataRegion?: string; // State
  structuredDataPostalCode?: string;
  structuredDataCountry?: string; // e.g., "IN"
  structuredDataTelephone?: string;
  structuredDataImage?: string; // URL to a default business logo/image
  socialProfileUrls?: StructuredDataSocialProfiles;

  updatedAt?: Timestamp;
}

// City and Area types
export interface FirestoreCity {
  id: string; // Firestore document ID
  name: string;
  slug: string;
  isActive: boolean;
  // SEO specific fields
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string; // comma-separated
  h1_title?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface FirestoreArea {
  id: string; // Firestore document ID
  name: string;
  slug: string;
  cityId: string; // Foreign key to FirestoreCity.id
  cityName: string; // Denormalized parent city name for display
  isActive: boolean;
  // SEO specific fields
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string; // comma-separated
  h1_title?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Tax Configuration Type
export interface FirestoreTax {
  id: string; // Firestore document ID
  taxName: string; // e.g., "GST", "VAT"
  taxPercent: number; // e.g., 5, 18
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// Marketing Settings Type
export interface FirebaseClientConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string; // Already exists, but good to group
  appId?: string;
  measurementId?: string;
}
export interface MarketingSettings {
  id?: string; // Should be "marketingConfiguration"
  googleTagId?: string;
  googleTagManagerId?: string;
  googleAdsConversionLabel?: string; // Added for Google Ads specific conversion
  metaPixelId?: string;
  metaConversionApi?: {
    accessToken?: string;
    pixelId?: string;
    testEventCode?: string;
  };
  googleMerchantCenter?: {
    feedUrl?: string;
    accountId?: string;
  };
  facebookCatalog?: {
    feedUrl?: string;
    pixelId?: string;
  };
  adsTxtContent?: string;
  googleAnalyticsId?: string; // For GA4 (G-XXXXXXX) or UA (UA-XXXXXX-Y)

  // Firebase settings
  firebasePublicVapidKey?: string; // For Web Push
  firebaseAdminSdkJson?: string; // For Admin SDK (JSON as string)
  firebaseClientConfig?: FirebaseClientConfig; // Grouped client config

  updatedAt?: Timestamp;
}

// User Notifications
export interface FirestoreNotification {
  id?: string; // Firestore document ID
  userId: string; // ID of the user this notification is for
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error' | 'booking_update' | 'admin_alert';
  href?: string; // Optional link for the notification to lead to
  read: boolean;
  createdAt: Timestamp;
}

// User Activity Log
export type UserActivityEventType =
  | 'newUser'
  | 'userLogin'
  | 'userLogout'
  | 'pageView'
  | 'addToCart'
  | 'removeFromCart'
  | 'newBooking'
  | 'checkoutStep'
  | 'adminAction';

export interface UserActivityEventData {
  pageUrl?: string;
  pageTitle?: string;
  serviceId?: string;
  serviceName?: string;
  quantity?: number;
  bookingId?: string;
  bookingDocId?: string; // Firestore document ID of the booking
  totalAmount?: number;
  itemCount?: number;
  paymentMethod?: string;
  services?: {id: string, name: string, quantity: number}[];
  checkoutStepName?: string;
  adminActionType?: string;
  adminActionDetails?: Record<string, any>;
  email?: string;
  fullName?: string;
  mobileNumber?: string;
  sourceGuestId?: string | null;
  loginMethod?: string;
  logoutMethod?: 'manual' | 'auto';
  [key: string]: any;
}

export interface UserActivity {
  id?: string; // Firestore document ID
  userId?: string | null; // Firebase Auth UID if logged in
  guestId?: string | null; // localStorage UID if anonymous
  eventType: UserActivityEventType;
  eventData: UserActivityEventData;
  userAgent?: string;
  timestamp: Timestamp;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  ipAddress?: string;
}

// Popup Types
export type PopupType =
  | "newsletter_signup"
  | "promotional"
  | "welcome"
  | "exit_intent"
  | "marketing_modal"
  | "lead_capture"
  | "subscribe"
  | "video";

export type PopupDisplayRuleType =
  | "on_page_load"
  | "on_exit_intent"
  | "after_x_seconds"
  | "on_scroll_percentage";

export type PopupDisplayFrequency =
  | "once_per_session"
  | "once_per_day"
  | "always";

export interface FirestorePopup {
  id: string; // Firestore document ID
  name: string; // Internal name for easy identification in admin
  popupType: PopupType;
  title?: string;
  displayText?: string;
  imageUrl?: string; // For image-based popups or background
  imageHint?: string;
  videoUrl?: string; // For video popups
  showEmailInput: boolean;
  promoCode?: string;
  targetUrl?: string; // URL to redirect to on click
  displayRuleType: PopupDisplayRuleType;
  displayRuleValue?: number; // Seconds for 'after_x_seconds', percentage for 'on_scroll_percentage'
  displayFrequency: PopupDisplayFrequency;
  showCloseButton: boolean;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// Chat Types
export interface ChatMessage {
  id?: string; // Firestore document ID
  chatSessionId: string; // ID of the chat session this message belongs to
  senderId: string; // UID of the sender (user UID or admin UID)
  senderType: 'user' | 'admin';
  text?: string; // Text content of the message
  imageUrl?: string; // URL if the message is an image
  timestamp: Timestamp; // When the message was sent
  isReadByAdmin?: boolean; // True if admin has read this user message
  isReadByUser?: boolean; // True if user has read this admin message
  // additional fields like reactions, message status (sent, delivered, read by other party) can be added
}

export interface ChatSession {
  id: string; // Firestore document ID (e.g., could be same as userId for user-admin chats)
  userId: string; // UID of the customer/user
  userName?: string; // Denormalized user display name
  userPhotoUrl?: string; // Denormalized user photo URL
  adminId?: string; // UID of the admin interacting (can be a general admin ID or specific if multiple admins)
  adminName?: string; // Denormalized admin display name
  adminPhotoUrl?: string; // Denormalized admin photo URL
  lastMessageText?: string;
  lastMessageTimestamp?: Timestamp;
  lastMessageSenderId?: string;
  userUnreadCount: number; // Messages sent by admin that user hasn't read
  adminUnreadCount: number; // Messages sent by user that admin hasn't read
  participants: string[]; // Array containing UIDs of participants (e.g., [userId, adminId])
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
