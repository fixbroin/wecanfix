
"use client";

import Header from './Header';
import Footer from './Footer';
import { usePathname } from 'next/navigation';
import type { PropsWithChildren } from 'react';
import { useState, useEffect, useCallback } from 'react'; // Added useCallback
import PopupDisplayManager from '@/components/shared/PopupDisplayManager';
import GlobalAdminPopup from '@/components/chat/GlobalAdminPopup';
import ReviewSubmissionModal from '@/components/reviews/ReviewSubmissionModal'; // Added
import type { FirestoreBooking } from '@/types/firestore'; // Added
import { useAuth } from '@/hooks/useAuth'; // Added
import { db } from '@/lib/firebase'; // Added
import { collection, query, where, getDocs, limit } from 'firebase/firestore'; // Added

const AppLayout: React.FC<PropsWithChildren> = ({ children }) => {
  const pathname = usePathname();
  const [isClientMounted, setIsClientMounted] = useState(false);
  
  const [showHeader, setShowHeader] = useState(true);
  const [showFooter, setShowFooter] = useState(true);

  const { user, isLoading: authIsLoading } = useAuth(); // Added useAuth
  const [pendingReviewBooking, setPendingReviewBooking] = useState<FirestoreBooking | null>(null);
  const [isReviewPopupOpen, setIsReviewPopupOpen] = useState(false);

  useEffect(() => {
    setIsClientMounted(true); 
  }, []);

  useEffect(() => {
    if (isClientMounted) { 
      const currentIsAdminRoute = pathname.startsWith('/admin');
      const currentIsAuthRoute = pathname.startsWith('/auth/');
      const currentIsCheckoutRoute = pathname.startsWith('/checkout');
      const currentIsCartRoute = pathname === '/cart';
      const currentIsCategoryDetailRoute = pathname.startsWith('/category/') && pathname !== '/categories';
      const currentIsServiceDetailRoute = pathname.startsWith('/service/');
      const currentIsChatPage = pathname === '/chat';
      const currentIsNotificationsPage = pathname === '/notifications';

      setShowHeader(!currentIsAdminRoute);
      setShowFooter(
        !currentIsAdminRoute &&
        !currentIsAuthRoute &&
        !currentIsCheckoutRoute &&
        !currentIsCartRoute &&
        !currentIsCategoryDetailRoute &&
        !currentIsServiceDetailRoute &&
        !currentIsChatPage &&
        !currentIsNotificationsPage
      );
    }
  }, [pathname, isClientMounted]);

  const fetchPendingReview = useCallback(async () => {
    if (user && !authIsLoading && !pendingReviewBooking && !isReviewPopupOpen) { // Only fetch if user exists and no review is currently pending/open
      try {
        const bookingsRef = collection(db, "bookings");
        const q = query(
          bookingsRef,
          where("userId", "==", user.uid),
          where("status", "==", "Completed"),
          where("isReviewedByCustomer", "==", false),
          limit(1) // Get the first pending review
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const bookingToReview = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as FirestoreBooking;
          console.log("Pending review found for booking:", bookingToReview.bookingId);
          setPendingReviewBooking(bookingToReview);
          setIsReviewPopupOpen(true);
        } else {
          console.log("No pending reviews found for user:", user.uid);
          setPendingReviewBooking(null); // Ensure it's cleared if no pending reviews
          setIsReviewPopupOpen(false);
        }
      } catch (error) {
        console.error("Error fetching pending reviews:", error);
      }
    }
  }, [user, authIsLoading, pendingReviewBooking, isReviewPopupOpen]); // Added dependencies


  useEffect(() => {
    // Fetch pending review on user login or if user is already logged in and on a non-admin/non-auth page
    if (isClientMounted && user && !authIsLoading) {
        const isAuthPage = pathname.startsWith('/auth/');
        const isAdminPage = pathname.startsWith('/admin/');
        if (!isAuthPage && !isAdminPage) {
            fetchPendingReview();
        }
    }
     // If user logs out, close the review popup and clear pending booking
    if (!user && !authIsLoading) {
        setIsReviewPopupOpen(false);
        setPendingReviewBooking(null);
    }
  }, [user, authIsLoading, isClientMounted, pathname, fetchPendingReview]);

  const handleReviewSubmitted = useCallback(() => {
    setIsReviewPopupOpen(false);
    setPendingReviewBooking(null);
    // Optionally, try to fetch the next pending review immediately
    // Or wait for next page load / login
    fetchPendingReview(); 
  }, [fetchPendingReview]);

  const shouldShowNewsletterPopupManager = isClientMounted && !pathname.startsWith('/admin') && pathname === '/';
  const shouldShowGlobalAdminPopup = isClientMounted && !pathname.startsWith('/admin');

  return (
    <div className="flex flex-col min-h-screen">
      {showHeader && <Header />}
      <main className="flex-grow">{children}</main>
      {showFooter && <Footer />}
      {shouldShowNewsletterPopupManager && <PopupDisplayManager />}
      {shouldShowGlobalAdminPopup && <GlobalAdminPopup />}
      {isClientMounted && pendingReviewBooking && (
        <ReviewSubmissionModal
          booking={pendingReviewBooking}
          isOpen={isReviewPopupOpen}
          onReviewSubmitted={handleReviewSubmitted}
        />
      )}
    </div>
  );
};

export default AppLayout;
