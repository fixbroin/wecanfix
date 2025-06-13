
"use client";

import type { PropsWithChildren } from 'react';
import React, { Suspense, useEffect } from 'react'; 
import { usePathname, useRouter } from 'next/navigation'; 
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import AdminSidebarContent from '@/components/admin/AdminSidebarContent';
import ProtectedRoute from '@/components/auth/ProtectedRoute'; 
import { useAuth } from '@/hooks/useAuth';
import { ADMIN_EMAIL } from '@/contexts/AuthContext'; 
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { UserCircle, KeyRound, LogOut, Loader2, Bell } from 'lucide-react'; 
import { auth } from '@/lib/firebase'; 
import { sendPasswordResetEmail } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useUnreadNotificationsCount } from '@/hooks/useUnreadNotificationsCount'; 
import { useLoading } from '@/contexts/LoadingContext'; 
import ThemeToggle from '@/components/shared/ThemeToggle'; // Added ThemeToggle import


const AdminPageLoader = () => (
  <div className="flex justify-center items-center min-h-[calc(100vh-120px)]">
    <Loader2 className="h-10 w-10 animate-spin text-primary" />
    <p className="ml-2 text-muted-foreground">Loading page...</p>
  </div>
);

export default function AdminLayout({ children }: PropsWithChildren) {
  const { user, isLoading: authIsLoading, logOut: handleLogoutAuth } = useAuth(); 
  const { toast } = useToast();
  const pathname = usePathname();
  const router = useRouter(); 
  const { showLoading, hideLoading } = useLoading(); 


  const { count: unreadAdminNotificationsCount, isLoading: isLoadingAdminNotifications } = useUnreadNotificationsCount(user?.uid);

  const handleChangePassword = async () => {
    if (user && user.email) {
      try {
        await sendPasswordResetEmail(auth, user.email);
        toast({ title: "Password Reset Email Sent", description: "Check your inbox for a password reset link." });
      } catch (error: any) {
        toast({ title: "Error", description: error.message || "Could not send password reset email.", variant: "destructive" });
      }
    } else {
      toast({ title: "Error", description: "Admin email not found.", variant: "destructive" });
    }
  };
  
  const navigateToAdminNotifications = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    showLoading();
    router.push('/admin/notifications'); 
  };

  useEffect(() => {
    
    return () => {
      hideLoading();
    };
  }, [pathname, user, hideLoading]);


  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (authIsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading Admin Panel...</p>
      </div>
    );
  }
  
  const isAdmin = user && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  return (
    <ProtectedRoute> 
      <SidebarProvider defaultOpen={true}> 
        <Sidebar collapsible="icon" variant="sidebar" className="border-r bg-card text-card-foreground">
          <AdminSidebarContent />
        </Sidebar>
        <SidebarInset className="bg-muted/30">
          <div className="flex h-16 items-center justify-between px-2 sm:px-4 border-b bg-background">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="hidden md:inline-flex" /> 
              <h1 className="text-lg sm:text-xl font-semibold">Admin Panel</h1>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle /> 
              {isAdmin && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="relative" 
                  aria-label="Admin Notifications"
                  onClick={navigateToAdminNotifications} 
                >
                  <Bell className="h-5 w-5" />
                  {!isLoadingAdminNotifications && unreadAdminNotificationsCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
                      {unreadAdminNotificationsCount > 9 ? '9+' : unreadAdminNotificationsCount}
                    </span>
                  )}
                </Button>
              )}

              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email || "Admin"} />
                        <AvatarFallback>
                          {user.email ? user.email[0].toUpperCase() : <UserCircle size={20} />}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {user.displayName || "Admin User"}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin/profile" onClick={() => showLoading()}>
                        <UserCircle className="mr-2 h-4 w-4" />
                        <span>Admin Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleChangePassword}>
                      <KeyRound className="mr-2 h-4 w-4" />
                      <span>Change Password</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { showLoading(); handleLogoutAuth(); }} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <div className="md:hidden">
                <SidebarTrigger />
              </div>
            </div>
          </div>
          <main className="p-2 sm:p-4 md:p-6">
            <Suspense fallback={<AdminPageLoader />}>
              {children}
            </Suspense>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
