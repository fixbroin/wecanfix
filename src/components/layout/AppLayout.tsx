
"use client";

import Header from './Header';
import Footer from './Footer';
import { usePathname } from 'next/navigation';
import type { PropsWithChildren } from 'react';
import { useState, useEffect } from 'react';
import PopupDisplayManager from '@/components/shared/PopupDisplayManager';
import GlobalAdminPopup from '@/components/chat/GlobalAdminPopup'; // Import GlobalAdminPopup

const AppLayout: React.FC<PropsWithChildren> = ({ children }) => {
  const pathname = usePathname();
  const [isClientMounted, setIsClientMounted] = useState(false);
  
  const [showHeader, setShowHeader] = useState(true);
  const [showFooter, setShowFooter] = useState(true);

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
      const currentIsNotificationsPage = pathname === '/notifications'; // Added check for notifications page

      setShowHeader(!currentIsAdminRoute);
      setShowFooter(
        !currentIsAdminRoute &&
        !currentIsAuthRoute &&
        !currentIsCheckoutRoute &&
        !currentIsCartRoute &&
        !currentIsCategoryDetailRoute &&
        !currentIsServiceDetailRoute &&
        !currentIsChatPage &&
        !currentIsNotificationsPage // Ensure footer is hidden on notifications page
      );
    }
  }, [pathname, isClientMounted]);

  const shouldShowNewsletterPopupManager = isClientMounted && !pathname.startsWith('/admin') && pathname === '/';
  const shouldShowGlobalAdminPopup = isClientMounted && !pathname.startsWith('/admin');


  return (
    <div className="flex flex-col min-h-screen">
      {showHeader && <Header />}
      <main className="flex-grow">{children}</main>
      {showFooter && <Footer />}
      {shouldShowNewsletterPopupManager && <PopupDisplayManager />}
      {shouldShowGlobalAdminPopup && <GlobalAdminPopup />}
    </div>
  );
};

export default AppLayout;
