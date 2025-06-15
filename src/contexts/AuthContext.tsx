
"use client";

import type { PropsWithChildren } from 'react';
import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  type User,
  type AuthError,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { FirestoreUser } from '@/types/firestore';
import { logUserActivity } from '@/lib/activityLogger';
import { getGuestId, clearGuestId } from '@/lib/guestIdManager';

// Define and export ADMIN_EMAIL here
export const ADMIN_EMAIL = "fixbro.in@gmail.com";

export interface SignUpData {
  fullName: string;
  email: string;
  mobileNumber: string;
  password?: string;
}

export interface LogInData {
  email: string;
  password?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  authActionRedirectPath: string | null;
  triggerAuthRedirect: (intendedPath: string) => void;
  signUp: (data: SignUpData) => Promise<void>;
  logIn: (data: LogInData) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authActionRedirectPath, setAuthActionRedirectPath] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams(); // For login/signup redirect
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const internalTriggerAuthRedirect = useCallback((intendedPath: string) => {
    setAuthActionRedirectPath(intendedPath);
    router.push(`/auth/login?redirect=${encodeURIComponent(intendedPath)}`);
  }, [router, setAuthActionRedirectPath]);

  const signUp = useCallback(async (data: SignUpData) => {
    if (!data.password) {
      toast({ title: "Error", description: "Password is required for signup.", variant: "destructive" });
      throw new Error("Password is required");
    }
    setIsLoading(true);
    const guestIdBeforeAuth = getGuestId(); // Get guest ID before it's cleared

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      await updateProfile(userCredential.user, { displayName: data.fullName });

      const userDocRef = doc(db, "users", userCredential.user.uid);
      const newUserFirestoreData: Omit<FirestoreUser, 'id' | 'lastLoginAt' | 'roles' | 'photoURL'> = {
        uid: userCredential.user.uid,
        email: data.email,
        displayName: data.fullName,
        mobileNumber: data.mobileNumber,
        isActive: true,
        createdAt: Timestamp.now(),
      };
      await setDoc(userDocRef, newUserFirestoreData);

      setUser(userCredential.user);
      toast({ title: "Success", description: "Account created successfully!" });

      // Log 'newUser' activity
      logUserActivity('newUser', {
        email: data.email,
        fullName: data.fullName,
        mobileNumber: data.mobileNumber,
        sourceGuestId: guestIdBeforeAuth // Log the guest ID associated with this new user
      }, userCredential.user.uid, null); // Pass null for guestId as user is now registered

      clearGuestId(); // Clear guest ID after successful registration

      const redirectPathFromQuery = searchParams.get('redirect');
      let finalRedirectPath = '/';

      if (redirectPathFromQuery && redirectPathFromQuery !== '/auth/login' && redirectPathFromQuery !== '/auth/signup') {
        finalRedirectPath = redirectPathFromQuery;
      } else if (authActionRedirectPath && authActionRedirectPath !== '/auth/login' && authActionRedirectPath !== '/auth/signup') {
        finalRedirectPath = authActionRedirectPath;
      }

      if (finalRedirectPath === '/auth/login' || finalRedirectPath === '/auth/signup') {
        finalRedirectPath = '/';
      }
      router.push(finalRedirectPath);

      if (authActionRedirectPath && (finalRedirectPath === authActionRedirectPath || finalRedirectPath === '/')) {
        setAuthActionRedirectPath(null);
      }

    } catch (error) {
      const authError = error as AuthError;
      console.error("Signup error:", authError);
      toast({ title: "Signup Failed", description: authError.message || "Could not create account.", variant: "destructive" });
      throw authError;
    } finally {
      setIsLoading(false);
    }
  }, [router, toast, searchParams, authActionRedirectPath, setAuthActionRedirectPath]);

  const logIn = useCallback(async (data: LogInData) => {
    if (!data.password) {
      toast({ title: "Error", description: "Password is required for login.", variant: "destructive" });
      throw new Error("Password is required");
    }
    setIsLoading(true);
    const guestIdBeforeAuth = getGuestId(); // Get guest ID before it's cleared

    try {
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      const userDocRef = doc(db, "users", userCredential.user.uid);
      await setDoc(userDocRef, { lastLoginAt: Timestamp.now() }, { merge: true });
      toast({ title: "Success", description: "Logged in successfully!" });

      // Log 'userLogin' activity
      logUserActivity('userLogin', {
        email: data.email,
        loginMethod: 'emailPassword', // Example detail
        sourceGuestId: guestIdBeforeAuth
      }, userCredential.user.uid, null);

      clearGuestId(); // Clear guest ID after successful login

      const redirectPathFromQuery = searchParams.get('redirect');
      let finalRedirectPath = '/';

      if (data.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        finalRedirectPath = '/admin';
      } else if (redirectPathFromQuery && redirectPathFromQuery !== '/auth/login' && redirectPathFromQuery !== '/auth/signup') {
        finalRedirectPath = redirectPathFromQuery;
      } else if (authActionRedirectPath && authActionRedirectPath !== '/auth/login' && authActionRedirectPath !== '/auth/signup') {
        finalRedirectPath = authActionRedirectPath;
      }

      if (finalRedirectPath === '/auth/login' || finalRedirectPath === '/auth/signup') {
        finalRedirectPath = '/';
      }
      router.push(finalRedirectPath);

      if (authActionRedirectPath && (finalRedirectPath === authActionRedirectPath || finalRedirectPath === '/')) {
        setAuthActionRedirectPath(null);
      }

    } catch (error) {
      const authError = error as AuthError;
      console.error("Login error:", authError);
      toast({ title: "Login Failed", description: authError.message || "Invalid credentials.", variant: "destructive" });
      throw authError;
    } finally {
      setIsLoading(false);
    }
  }, [router, toast, searchParams, authActionRedirectPath, setAuthActionRedirectPath]);

  const logOut = useCallback(async () => {
    setIsLoading(true);
    const userIdForLog = user?.uid; // Capture before user state is cleared
    const userEmailForLog = user?.email; // Capture email for logging
    try {
      if (userIdForLog) {
        logUserActivity('userLogout', { logoutMethod: 'manual', email: userEmailForLog }, userIdForLog, null);
      }
      await signOut(auth);
      setUser(null);
      setAuthActionRedirectPath(null);
      toast({ title: "Logged Out", description: "You have been logged out." });
      router.push('/auth/login');
    } catch (error) {
      const authError = error as AuthError;
      console.error("Logout error:", authError);
      toast({ title: "Logout Failed", description: authError.message || "Could not log out.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [router, toast, user]);

  const contextValue: AuthContextType = useMemo(() => {
    return {
      user,
      isLoading,
      authActionRedirectPath,
      triggerAuthRedirect: internalTriggerAuthRedirect,
      signUp,
      logIn,
      logOut,
    };
  }, [user, isLoading, authActionRedirectPath, internalTriggerAuthRedirect, signUp, logIn, logOut]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export default AuthContext;
