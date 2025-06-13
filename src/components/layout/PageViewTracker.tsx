
"use client";

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMarketingSettings } from '@/hooks/useMarketingSettings';
import { logUserActivity } from '@/lib/activityLogger';
import { getGuestId } from '@/lib/guestIdManager';
import { useAuth } from '@/hooks/useAuth';

const PageViewTracker = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { settings: marketingSettings, isLoading: isLoadingMarketingSettings } = useMarketingSettings();
  const { user, isLoading: isLoadingAuth } = useAuth();

  useEffect(() => {
    if (isLoadingMarketingSettings || isLoadingAuth) {
      return; // Wait for settings and auth state to be loaded
    }

    const fullUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

    // Log page view to Firestore
    const guestId = !user ? getGuestId() : null;
    logUserActivity(
      'pageView',
      { pageUrl: fullUrl, pageTitle: typeof document !== 'undefined' ? document.title : '' },
      user?.uid,
      guestId
    );

    // Google Tag Manager
    if (marketingSettings.googleTagManagerId && typeof window !== 'undefined' && window.dataLayer) {
      window.dataLayer.push({
        event: 'page_view',
        page_path: fullUrl,
        page_title: typeof document !== 'undefined' ? document.title : undefined,
        // You can add more GTM-specific parameters here if needed
      });
    }

    // gtag.js (for GA4 or Google Ads without GTM)
    if (marketingSettings.googleTagId && typeof window !== 'undefined' && typeof window.gtag === 'function' && !marketingSettings.googleTagManagerId) {
      window.gtag('config', marketingSettings.googleTagId, {
        page_path: fullUrl,
        page_title: typeof document !== 'undefined' ? document.title : undefined,
      });
    }

  }, [pathname, searchParams, marketingSettings, isLoadingMarketingSettings, user, isLoadingAuth]);

  return null; // This component does not render anything
};

export default PageViewTracker;
