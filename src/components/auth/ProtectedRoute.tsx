
"use client";

import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ADMIN_EMAIL } from '@/contexts/AuthContext'; // Correct import for ADMIN_EMAIL
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ProtectedRoute: React.FC<PropsWithChildren> = ({ children }) => {
  const { user, isLoading, triggerAuthRedirect } = useAuth(); // Added triggerAuthRedirect
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const knownPageSlugs = ["about-us", "contact-us", "careers", "terms-of-service", "privacy-policy", "help-center"]; // Added faq if it's public

  useEffect(() => {
    if (isLoading) return;

    const isAdminRoute = pathname.startsWith('/admin');
    const isAdminLoginPage = pathname === '/admin/login';
    const isGeneralAuthPage = pathname.startsWith('/auth/'); // /auth/login, /auth/signup, /auth/forgot-password
    const isPublicAppRoute = pathname === '/' || 
                             pathname.startsWith('/category/') || 
                             pathname.startsWith('/service/') ||
                             pathname === '/cart' || // Cart itself might need login to *checkout* but viewing might be allowed
                             pathname === '/faq' ||
                             pathname === '/notifications' || // Notifications typically need auth
                             knownPageSlugs.some(slug => pathname === `/${slug}`);

    if (!user) { // User is not logged in
      if (isAdminRoute && !isAdminLoginPage) {
        router.push('/admin/login');
      } else if (!isGeneralAuthPage && !isPublicAppRoute && !isAdminRoute) {
        // This covers routes like /profile, /my-bookings, /checkout/*
        // If it's a route that implicitly requires auth and isn't explicitly public or an auth page
        if (pathname === '/profile' || pathname === '/my-bookings' || pathname.startsWith('/checkout')) {
          triggerAuthRedirect(pathname); // Use new trigger
        }
      }
    } else { // User is logged in
      if (isAdminRoute) {
        if (user.email !== ADMIN_EMAIL) {
          toast({ title: "Access Denied", description: "You are not authorized for this page.", variant: "destructive" });
          router.push('/');
        }
      } else if (isAdminLoginPage && user.email === ADMIN_EMAIL) {
        router.push('/admin');
      } else if (isAdminLoginPage && user.email !== ADMIN_EMAIL) {
        toast({ title: "Access Denied", description: "Admin login is for administrators only.", variant: "destructive"});
        router.push('/');
      }
    }
  }, [user, isLoading, router, pathname, toast, triggerAuthRedirect]);


  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Conditional rendering for loading/redirect states
  if (!user) {
    const isAdminRoute = pathname.startsWith('/admin');
    const isAdminLoginPage = pathname === '/admin/login';
    const isGeneralAuthPage = pathname.startsWith('/auth/');
    const isPublicAppRoute = pathname === '/' || 
                             pathname.startsWith('/category/') || 
                             pathname.startsWith('/service/') ||
                             pathname === '/cart' ||
                             pathname === '/faq' ||
                            //  pathname === '/notifications' || // notifications likely needs auth
                             knownPageSlugs.some(slug => pathname === `/${slug}`);

    if (isAdminRoute && !isAdminLoginPage) {
      return <div className="flex justify-center items-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-2">Redirecting to admin login...</p></div>;
    }
    // For non-admin routes that are protected (e.g. /profile, /my-bookings, /checkout/*, /notifications)
    if (!isGeneralAuthPage && !isPublicAppRoute && !isAdminRoute && (pathname === '/profile' || pathname === '/my-bookings' || pathname.startsWith('/checkout') || pathname === '/notifications')) {
      return <div className="flex justify-center items-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-2">Redirecting to login...</p></div>;
    }
  }
  
  if (user && user.email !== ADMIN_EMAIL && pathname.startsWith('/admin') && pathname !== '/admin/login') {
      return <div className="flex justify-center items-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-2">Unauthorized. Redirecting...</p></div>;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
