
"use client";

import { useState, useEffect } from 'react';
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { Mail, User, Shield, Edit3, KeyRound, Trash2, Loader2, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { updateProfile, sendPasswordResetEmail, deleteUser } from "firebase/auth";
import { auth, db } from '@/lib/firebase'; // Import db
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore"; // Firestore functions
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

const updateNameSchema = z.object({
  displayName: z.string().min(2, { message: "Name must be at least 2 characters." }),
});
type UpdateNameFormValues = z.infer<typeof updateNameSchema>;

const updateMobileSchema = z.object({
  mobileNumber: z.string()
    .min(10, { message: "Mobile number must be at least 10 digits." })
    .max(15, { message: "Mobile number cannot exceed 15 digits." })
    .regex(/^\+?[1-9]\d{1,14}$/, { message: "Invalid mobile number format (e.g., +919876543210)." }),
});
type UpdateMobileFormValues = z.infer<typeof updateMobileSchema>;


export default function ProfilePage() {
  const { user, logOut } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
  const [isSubmittingName, setIsSubmittingName] = useState(false);
  const [isMobileDialogOpen, setIsMobileDialogOpen] = useState(false);
  const [isSubmittingMobile, setIsSubmittingMobile] = useState(false);
  const [mobileNumber, setMobileNumber] = useState<string | null>(null);
  const [isLoadingMobile, setIsLoadingMobile] = useState(true); // For Firestore fetch

  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const nameForm = useForm<UpdateNameFormValues>({
    resolver: zodResolver(updateNameSchema),
    defaultValues: {
      displayName: user?.displayName || "",
    },
  });

  const mobileForm = useForm<UpdateMobileFormValues>({
    resolver: zodResolver(updateMobileSchema),
    defaultValues: {
      mobileNumber: "",
    },
  });

  useEffect(() => {
    if (user) {
      nameForm.reset({ displayName: user.displayName || "" });
      
      const fetchMobileNumber = async () => {
        setIsLoadingMobile(true);
        try {
          const userDocRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists() && docSnap.data().mobileNumber) {
            const fetchedMobile = docSnap.data().mobileNumber;
            setMobileNumber(fetchedMobile);
            mobileForm.reset({ mobileNumber: fetchedMobile });
          } else {
            setMobileNumber(null);
            mobileForm.reset({ mobileNumber: "" });
          }
        } catch (error) {
          console.error("Error fetching mobile number from Firestore:", error);
          toast({ title: "Error", description: "Could not load mobile number.", variant: "destructive" });
          setMobileNumber(null);
          mobileForm.reset({ mobileNumber: "" });
        } finally {
          setIsLoadingMobile(false);
        }
      };
      fetchMobileNumber();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);


  const handleUpdateName = async (values: UpdateNameFormValues) => {
    if (!user || !auth.currentUser) {
      toast({ title: "Error", description: "You must be logged in to update your name.", variant: "destructive" });
      return;
    }
    setIsSubmittingName(true);
    try {
      await updateProfile(auth.currentUser, { displayName: values.displayName });
      
      // Also update displayName in the user's Firestore document if you store it there
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { displayName: values.displayName });

      toast({ title: "Success", description: "Your name has been updated." });
      setIsNameDialogOpen(false);
    } catch (error: any) {
      console.error("Error updating name:", error);
      toast({ title: "Error", description: error.message || "Could not update name.", variant: "destructive" });
    } finally {
      setIsSubmittingName(false);
    }
  };

  const handleUpdateMobileNumber = async (values: UpdateMobileFormValues) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsSubmittingMobile(true);
    try {
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, { mobileNumber: values.mobileNumber, email: user.email, displayName: user.displayName || "" }, { merge: true });
      setMobileNumber(values.mobileNumber);
      mobileForm.reset({ mobileNumber: values.mobileNumber });
      toast({ title: "Success", description: "Your mobile number has been updated." });
      setIsMobileDialogOpen(false);
    } catch (error: any) {
      console.error("Error updating mobile number in Firestore:", error);
      toast({ title: "Error", description: error.message || "Could not update mobile number.", variant: "destructive" });
    } finally {
      setIsSubmittingMobile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user || !user.email) {
      toast({ title: "Error", description: "User email not found or not verified.", variant: "destructive" });
      return;
    }
    setIsSendingResetEmail(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast({ title: "Password Reset Email Sent", description: "Check your inbox for a password reset link." });
    } catch (error: any) {
      console.error("Error sending password reset email:", error);
      toast({ title: "Error", description: error.message || "Could not send password reset email.", variant: "destructive" });
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !auth.currentUser) {
      toast({ title: "Error", description: "You must be logged in to delete your account.", variant: "destructive" });
      return;
    }
    setIsDeletingAccount(true);
    try {
      // Attempt to delete Firestore document for the user
      // This is best-effort client-side. Ideally handled by a Cloud Function.
      try {
        const userDocRef = doc(db, "users", user.uid);
        await deleteDoc(userDocRef);
      } catch (firestoreError) {
        console.warn("Could not delete user data from Firestore:", firestoreError);
        // Proceed with auth deletion even if Firestore cleanup fails client-side
      }

      await deleteUser(auth.currentUser);
      toast({ title: "Account Deleted", description: "Your account has been successfully deleted." });
      router.push('/'); 
    } catch (error: any) {
      console.error("Error deleting account:", error);
      if (error.code === 'auth/requires-recent-login') {
        toast({
          title: "Action Requires Recent Login",
          description: "For security, deleting your account requires you to have logged in recently. Please log in again and retry. You will be logged out now.",
          variant: "destructive",
          duration: 7000, 
        });
        await logOut(); // Log out the user so they can re-login
      } else {
        toast({ title: "Error Deleting Account", description: error.message || "Could not delete account.", variant: "destructive" });
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };


  if (!user) {
    return null; 
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <Avatar className="w-24 h-24 mx-auto mb-4 border-2 border-primary">
              <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email || "User"} />
              <AvatarFallback className="text-3xl">
                {user.displayName ? user.displayName[0].toUpperCase() : user.email ? user.email[0].toUpperCase() : "U"}
              </AvatarFallback>
            </Avatar>
            <CardTitle className="text-3xl font-headline">
              {user.displayName || "Your Profile"}
            </CardTitle>
            <CardDescription className="text-md text-muted-foreground">
              Manage your personal information and account settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center"><User className="mr-2 h-5 w-5 text-primary" /> Full Name</h3>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-md">
                <p className="text-muted-foreground">{user.displayName || "Not set"}</p>
                <Button variant="ghost" size="sm" onClick={() => { nameForm.reset({ displayName: user.displayName || "" }); setIsNameDialogOpen(true); }}>
                  <Edit3 className="mr-1 h-4 w-4" /> Edit
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center"><Mail className="mr-2 h-5 w-5 text-primary" /> Email Address</h3>
              <p className="text-muted-foreground p-3 bg-secondary/30 rounded-md">{user.email}</p>
              {user.emailVerified ? (
                <span className="text-xs text-green-600 flex items-center"><Shield className="mr-1 h-3 w-3"/>Email Verified</span>
              ) : (
                <span className="text-xs text-yellow-600">Email not verified (Verification feature TBD)</span>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center"><Phone className="mr-2 h-5 w-5 text-primary" /> Mobile Number</h3>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-md min-h-[40px]">
                {isLoadingMobile ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <p className="text-muted-foreground">{mobileNumber || "Not set"}</p>
                )}
                <Button variant="ghost" size="sm" onClick={() => { mobileForm.reset({ mobileNumber: mobileNumber || "" }); setIsMobileDialogOpen(true);}} disabled={isLoadingMobile}>
                  <Edit3 className="mr-1 h-4 w-4" /> Edit
                </Button>
              </div>
            </div>

             <div className="space-y-4 border-t pt-6">
              <h3 className="text-xl font-semibold">Account Actions</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" onClick={handleChangePassword} disabled={isSendingResetEmail}>
                  {isSendingResetEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  Change Password
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="sm:ml-auto" disabled={isDeletingAccount}>
                      {isDeletingAccount ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your
                        account and remove your data from our servers.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeletingAccount}>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAccount} disabled={isDeletingAccount} className="bg-destructive hover:bg-destructive/90">
                        {isDeletingAccount && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Yes, delete account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Update Name Dialog */}
      <Dialog open={isNameDialogOpen} onOpenChange={setIsNameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Your Name</DialogTitle>
            <DialogDescription>
              Enter your new display name below.
            </DialogDescription>
          </DialogHeader>
          <Form {...nameForm}>
            <form onSubmit={nameForm.handleSubmit(handleUpdateName)} className="space-y-4 py-2">
              <FormField
                control={nameForm.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="displayName">Full Name</FormLabel>
                    <FormControl>
                      <Input id="displayName" placeholder="Your full name" {...field} disabled={isSubmittingName} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isSubmittingName}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmittingName}>
                  {isSubmittingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Update Mobile Number Dialog */}
      <Dialog open={isMobileDialogOpen} onOpenChange={setIsMobileDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Mobile Number</DialogTitle>
            <DialogDescription>
              Enter your new mobile number below (e.g., +919876543210).
            </DialogDescription>
          </DialogHeader>
          <Form {...mobileForm}>
            <form onSubmit={mobileForm.handleSubmit(handleUpdateMobileNumber)} className="space-y-4 py-2">
              <FormField
                control={mobileForm.control}
                name="mobileNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="mobileNumber">Mobile Number</FormLabel>
                    <FormControl>
                      <Input id="mobileNumber" placeholder="e.g., +919876543210" {...field} disabled={isSubmittingMobile} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isSubmittingMobile}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmittingMobile}>
                  {isSubmittingMobile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

    </ProtectedRoute>
  );
}
    

    
