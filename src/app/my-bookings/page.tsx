
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ListOrdered, PackageSearch, ArrowLeft, Loader2, Eye, Trash2, Download } from "lucide-react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, Timestamp, deleteDoc } from "firebase/firestore";
import type { FirestoreBooking, BookingStatus, GlobalWebSettings } from "@/types/firestore"; // Import GlobalWebSettings
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { generateInvoicePdf } from '@/lib/invoiceGenerator'; // Import the new generator
import { useGlobalSettings } from "@/hooks/useGlobalSettings"; // Import hook for company details


// Helper to format Firestore Timestamp to a readable string for display
const formatBookingTimestamp = (timestamp?: Timestamp): string => {
  if (!timestamp) return 'N/A';
  return timestamp.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + timestamp.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};


export default function MyBookingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [myBookings, setMyBookings] = useState<FirestoreBooking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [isCancelling, setIsCancelling] = useState<string | null>(null);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState<string | null>(null);
  
  // Fetch global settings for company details on invoice
  const { settings: globalCompanySettings, isLoading: isLoadingCompanySettings } = useGlobalSettings();


  useEffect(() => {
    if (!user || authLoading) {
      if (!authLoading && !user) setIsLoadingBookings(false);
      return;
    }

    setIsLoadingBookings(true);
    const bookingsCollectionRef = collection(db, "bookings");
    const q = query(
      bookingsCollectionRef,
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedBookings = querySnapshot.docs.map(docSnap => ({ // Renamed doc to docSnap
        ...docSnap.data(),
        id: docSnap.id, 
      } as FirestoreBooking));
      setMyBookings(fetchedBookings);
      setIsLoadingBookings(false);
    }, (error) => {
      console.error("Error fetching user bookings: ", error);
      toast({ title: "Error", description: "Could not fetch your bookings.", variant: "destructive" });
      setIsLoadingBookings(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, toast]);

  const handleCancelBooking = async (bookingId: string) => {
    if (!bookingId) {
      toast({ title: "Error", description: "Booking ID is missing.", variant: "destructive" });
      return;
    }
    setIsCancelling(bookingId);
    const bookingDocRef = doc(db, "bookings", bookingId);
    try {
      await updateDoc(bookingDocRef, {
        status: "Cancelled" as BookingStatus,
        updatedAt: Timestamp.now()
      });
      toast({ title: "Booking Cancelled", description: "Your booking has been cancelled." });
    } catch (error) {
      console.error("Error cancelling booking: ", error);
      toast({ title: "Error", description: "Could not cancel your booking.", variant: "destructive" });
    } finally {
      setIsCancelling(null);
    }
  };

  const canBeCancelled = (status: BookingStatus) => {
    return status === "Pending Payment" || status === "Confirmed";
  };

  const handleDownloadInvoice = async (booking: FirestoreBooking) => {
    if (!booking.id) {
      toast({ title: "Error", description: "Booking data is incomplete for invoice.", variant: "destructive"});
      return;
    }
    setIsDownloadingInvoice(booking.id);
    try {
      const companyDetailsForInvoice = {
        name: globalCompanySettings?.websiteName || "FixBro Services",
        address: globalCompanySettings?.address || "123 FixIt Lane, Repair City, RC 10001",
        contactEmail: globalCompanySettings?.contactEmail || "fixbro.in@gmail.com",
        contactMobile: globalCompanySettings?.contactMobile || "+91-9090909090",
        logoUrl: globalCompanySettings?.logoUrl || undefined,
      };
      await generateInvoicePdf(booking, companyDetailsForInvoice);
      toast({ title: "Invoice Downloaded", description: `Invoice for ${booking.bookingId} should start downloading.`});
    } catch (error) {
      console.error("Error generating invoice:", error);
      toast({ title: "Invoice Error", description: "Could not generate the invoice PDF.", variant: "destructive"});
    } finally {
      setIsDownloadingInvoice(null);
    }
  };

  if (authLoading || isLoadingBookings || isLoadingCompanySettings) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <p className="mt-2 text-muted-foreground">Loading your bookings...</p>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl md:text-4xl font-headline font-semibold text-foreground">
            My Bookings
          </h1>
          <Link href="/" passHref>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </Button>
          </Link>
        </div>

        {myBookings.length === 0 ? (
          <div className="text-center py-12">
            <PackageSearch className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No Bookings Yet</h2>
            <p className="text-muted-foreground mb-6">You haven't made any bookings with FixBro.</p>
            <Link href="/categories" passHref>
              <Button>Book a Service</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {myBookings.map((booking) => (
              <Card key={booking.id} className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                    <CardTitle className="text-xl font-headline mb-2 sm:mb-0">
                      {booking.services.map(s => s.name).join(', ')}
                    </CardTitle>
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-full
                        ${booking.status === "Confirmed" ? "bg-green-100 text-green-700" :
                          booking.status === "Completed" ? "bg-blue-100 text-blue-700" :
                          booking.status === "Pending Payment" ? "bg-yellow-100 text-yellow-700" :
                          booking.status === "Cancelled" ? "bg-red-100 text-red-700" :
                          booking.status === "Processing" ? "bg-purple-100 text-purple-700" :
                          "bg-gray-100 text-gray-700"}`}
                    >
                      {booking.status}
                    </span>
                  </div>
                  <CardDescription>Booking ID: {booking.bookingId}</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Scheduled Date</p>
                    <p className="font-medium">{booking.scheduledDate}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Time Slot</p>
                    <p className="font-medium">{booking.scheduledTimeSlot}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Amount</p>
                    <p className="font-medium">₹{booking.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="sm:col-span-2 md:col-span-3">
                    <p className="text-muted-foreground">Booked On</p>
                    <p className="font-medium">{formatBookingTimestamp(booking.createdAt)}</p>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-2">
                  <Button variant="outline" size="sm" className="w-full sm:w-auto" disabled>
                    <Eye className="mr-1 h-4 w-4" /> View Details (Soon)
                  </Button>
                  {booking.status === "Completed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => handleDownloadInvoice(booking)}
                      disabled={isDownloadingInvoice === booking.id}
                    >
                      {isDownloadingInvoice === booking.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
                      Download Invoice
                    </Button>
                  )}
                  {canBeCancelled(booking.status) && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="w-full sm:w-auto"
                          disabled={isCancelling === booking.id}
                        >
                          {isCancelling === booking.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
                          Cancel Booking
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure you want to cancel?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. Your booking for "{booking.services.map(s => s.name).join(', ')}" will be cancelled.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>No, keep booking</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleCancelBooking(booking.id!)} className="bg-destructive hover:bg-destructive/90">
                            Yes, cancel booking
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
