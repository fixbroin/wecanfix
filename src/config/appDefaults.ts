
import type { AppSettings, ThemeColors } from '@/types/firestore';
import { DEFAULT_LIGHT_THEME_COLORS_HSL, DEFAULT_DARK_THEME_COLORS_HSL } from '@/lib/colorUtils';

export const defaultAppSettings: AppSettings = {
  // General
  enableMinimumBookingPolicy: false,
  minimumBookingAmount: 500,
  visitingChargeAmount: 100, // This is the DISPLAYED visiting charge
  isVisitingChargeTaxInclusive: false, // Default to exclusive
  minimumBookingPolicyDescription: "A visiting charge of ₹{VISITING_CHARGE} will be applied if your booking total is below ₹{MINIMUM_BOOKING_AMOUNT}.",
  googleMapsApiKey: "",
  smtpHost: "",
  smtpPort: "587", // Default to common non-SSL/TLS port
  smtpUser: "",
  smtpPass: "",
  senderEmail: "",
  enableHeroCarousel: true,
  enableCarouselAutoplay: true, 
  carouselAutoplayDelay: 5000, 
  enableTaxOnVisitingCharge: true, 
  visitingChargeTaxPercent: 5,     
  // Payment
  enableOnlinePayment: true,
  razorpayKeyId: "",
  razorpayKeySecret: "",
  enableCOD: true, // Represents "Pay After Service"
  // Time Slots
  timeSlotSettings: {
    morning: { startTime: "09:00", endTime: "12:00" },
    afternoon: { startTime: "13:00", endTime: "17:00" },
    evening: { startTime: "17:00", endTime: "19:00" },
    slotIntervalMinutes: 60,
  },
  enableLimitLateBookings: false,
  limitLateBookingHours: 4,
  // Platform Fees
  platformFees: [], // Default to an empty array
};

// This is now part of useGlobalSettings default, not AppSettings
// export const defaultThemeColors: ThemeColors = {
//   light: DEFAULT_LIGHT_THEME_COLORS_HSL,
//   dark: DEFAULT_DARK_THEME_COLORS_HSL,
// };

    