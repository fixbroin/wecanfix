
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tag, Eye, Loader2, PackageSearch, XIcon, Edit, Trash2 } from "lucide-react";
import type { FirestoreBooking, BookingStatus } from '@/types/firestore';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, Timestamp, deleteDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import BookingDetailsModalContent from '@/components/admin/BookingDetailsModalContent';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';



const statusOptions: BookingStatus[] = ["Pending Payment", "Confirmed", "Processing", "Completed", "Cancelled", "Rescheduled"];
const receivedPaymentMethods = ["Cash", "UPI", "Bank Transfer", "Card (POS)"];

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<FirestoreBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<BookingStatus | "All">("All");
  const { toast } = useToast();
  const router = useRouter(); 
  const [selectedBooking, setSelectedBooking] = useState<FirestoreBooking | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // State for payment method confirmation dialog
  const [isPaymentMethodDialogOpen, setIsPaymentMethodDialogOpen] = useState(false);
  const [selectedBookingForPaymentUpdate, setSelectedBookingForPaymentUpdate] = useState<FirestoreBooking | null>(null);
  const [paymentReceivedMethodForDialog, setPaymentReceivedMethodForDialog] = useState<string>("");


  useEffect(() => {
    setIsLoading(true);
    const bookingsCollectionRef = collection(db, "bookings");
    const q = query(bookingsCollectionRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedBookings = querySnapshot.docs.map(docSnap => ({
        ...docSnap.data(),
        id: docSnap.id, 
      } as FirestoreBooking));
      setBookings(fetchedBookings);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching bookings: ", error);
      toast({ title: "Error", description: "Could not fetch bookings.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const filteredBookings = useMemo(() => {
    if (filterStatus === "All") {
      return bookings;
    }
    return bookings.filter(booking => booking.status === filterStatus);
  }, [bookings, filterStatus]);

  const handleStatusChange = async (booking: FirestoreBooking, newStatus: BookingStatus) => {
    const bookingId = booking.id;
    if (!bookingId) {
        toast({title: "Error", description: "Booking ID is missing.", variant: "destructive"});
        return;
    }

    const requiresPaymentMethodConfirmation =
      newStatus === "Completed" &&
      (booking.paymentMethod === "Pay After Service" || // Specific string from your payment flow
       booking.paymentMethod === "Cash on Delivery" || // Common alternative
       booking.status === "Pending Payment");    // If status implies payment hasn't been made/confirmed

    if (requiresPaymentMethodConfirmation) {
        setSelectedBookingForPaymentUpdate(booking);
        setIsPaymentMethodDialogOpen(true);
    } else {
        setIsUpdatingStatus(bookingId);
        const bookingDocRef = doc(db, "bookings", bookingId);
        try {
          await updateDoc(bookingDocRef, { 
            status: newStatus,
            updatedAt: Timestamp.now() 
          });
          toast({ title: "Success", description: `Booking status updated to ${newStatus}.` });
        } catch (error) {
          console.error("Error updating booking status: ", error);
          toast({ title: "Error", description: "Could not update booking status.", variant: "destructive" });
        } finally {
          setIsUpdatingStatus(null);
        }
    }
  };

  const handleConfirmPaymentAndUpdateStatus = async () => {
    if (!selectedBookingForPaymentUpdate || !selectedBookingForPaymentUpdate.id || !paymentReceivedMethodForDialog) {
      toast({ title: "Error", description: "Booking or payment method missing for confirmation.", variant: "destructive" });
      return;
    }
    
    const bookingIdToUpdate = selectedBookingForPaymentUpdate.id;
    setIsUpdatingStatus(bookingIdToUpdate); // Show loader on the table row being updated
    setIsPaymentMethodDialogOpen(false); // Close dialog

    const bookingDocRef = doc(db, "bookings", bookingIdToUpdate);
    try {
      await updateDoc(bookingDocRef, {
        status: "Completed" as BookingStatus,
        paymentMethod: paymentReceivedMethodForDialog, // Update the payment method
        updatedAt: Timestamp.now()
      });
      toast({ title: "Success", description: `Booking marked as Completed. Payment via ${paymentReceivedMethodForDialog}.` });
    } catch (error) {
      console.error("Error updating booking status and payment method: ", error);
      toast({ title: "Error", description: "Could not update booking.", variant: "destructive" });
    } finally {
      setIsUpdatingStatus(null);
      setSelectedBookingForPaymentUpdate(null);
      setPaymentReceivedMethodForDialog("");
    }
  };

  const handleViewDetails = (booking: FirestoreBooking) => {
    setSelectedBooking(booking);
    setIsDetailsModalOpen(true);
  };

  const handleEditBooking = (bookingId: string) => {
    if (bookingId) {
      router.push(`/admin/bookings/edit/${bookingId}`);
    } else {
       toast({ title: "Error", description: "Booking ID is missing.", variant: "destructive" });
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (!bookingId) {
      toast({ title: "Error", description: "Booking ID is missing for delete.", variant: "destructive" });
      return;
    }
    setIsDeleting(bookingId);
    const bookingDocRef = doc(db, "bookings", bookingId);
    try {
      await deleteDoc(bookingDocRef);
      toast({ title: "Success", description: `Booking ${bookingId} deleted.` });
    } catch (error) {
      console.error("Error deleting booking: ", error);
      toast({ title: "Error", description: "Could not delete booking.", variant: "destructive" });
    } finally {
      setIsDeleting(null);
    }
  };


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-2xl flex items-center">
              <Tag className="mr-2 h-6 w-6 text-primary" /> Manage Bookings
            </CardTitle>
            <CardDescription>
              View and manage all customer bookings. Update booking statuses and view details.
            </CardDescription>
          </div>
          <div className="mt-4 sm:mt-0 w-full sm:w-auto sm:min-w-[200px]">
            <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as BookingStatus | "All")}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Statuses</SelectItem>
                {statusOptions.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-10">
              <PackageSearch className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {filterStatus === "All" ? "No bookings found yet." : `No bookings found with status: ${filterStatus}.`}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead className="min-w-[150px]">Status</TableHead>
                  <TableHead className="text-right min-w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium text-xs">{booking.bookingId}</TableCell>
                    <TableCell>
                      <div>{booking.customerName}</div>
                      <div className="text-xs text-muted-foreground">{booking.customerEmail}</div>
                    </TableCell>
                    <TableCell>{booking.scheduledDate}</TableCell>
                    <TableCell>{booking.scheduledTimeSlot}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">
                      {booking.services.map(s => s.name).join(', ')}
                    </TableCell>
                    <TableCell className="text-right">{booking.totalAmount.toLocaleString()}</TableCell>
                    <TableCell>
                       <Select 
                          value={booking.status} 
                          onValueChange={(newStatus) => handleStatusChange(booking, newStatus as BookingStatus)}
                          disabled={isUpdatingStatus === booking.id}
                        >
                          <SelectTrigger className="h-8 text-xs min-w-[120px]">
                              {isUpdatingStatus === booking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue placeholder="Set Status" />}
                          </SelectTrigger>
                          <SelectContent>
                              {statusOptions.map(status => (
                              <SelectItem key={status} value={status} className="text-xs">{status}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-2 sm:justify-end">
                        <Button variant="outline" size="icon" onClick={() => handleViewDetails(booking)} title="View Details">
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View Details</span>
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => handleEditBooking(booking.id!)} title="Edit Booking" disabled={isDeleting === booking.id || !booking.id}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit Booking</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" title="Delete Booking" disabled={isDeleting === booking.id || !booking.id}>
                              {isDeleting === booking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              <span className="sr-only">Delete Booking</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the booking <span className="font-semibold">{booking.bookingId}</span>.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteBooking(booking.id!)} className="bg-destructive hover:bg-destructive/90">
                                Yes, delete booking
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedBooking && (
        <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
          <DialogContent className="max-w-3xl w-[90vw] max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-4 border-b">
              <DialogTitle className="text-xl">Booking Details: {selectedBooking.bookingId}</DialogTitle>
              <DialogDescription>
                Review complete information for this booking.
              </DialogDescription>
               <DialogClose asChild>
                 <Button variant="ghost" size="icon" className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                    <XIcon className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                 </Button>
              </DialogClose>
            </DialogHeader>
            <div className="overflow-y-auto flex-grow p-6">
                 <BookingDetailsModalContent booking={selectedBooking} />
            </div>
            <div className="p-6 border-t flex justify-end">
                 <DialogClose asChild>
                    <Button type="button" variant="outline">Close</Button>
                 </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Payment Method Confirmation Dialog */}
      <Dialog open={isPaymentMethodDialogOpen} onOpenChange={(isOpen) => {
          if (!isOpen) {
              setSelectedBookingForPaymentUpdate(null);
              setPaymentReceivedMethodForDialog("");
          }
          setIsPaymentMethodDialogOpen(isOpen);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Payment for Booking</DialogTitle>
            <DialogDescription>
              Booking ID: <span className="font-semibold">{selectedBookingForPaymentUpdate?.bookingId}</span>
              <br />
              Select the method used to receive payment.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Label>Payment Received Via:</Label>
            <RadioGroup value={paymentReceivedMethodForDialog} onValueChange={setPaymentReceivedMethodForDialog}>
              {receivedPaymentMethods.map(method => (
                <div key={method} className="flex items-center space-x-2">
                  <RadioGroupItem value={method} id={`payment-method-${method.toLowerCase().replace(/\s+/g, '-')}`} />
                  <Label htmlFor={`payment-method-${method.toLowerCase().replace(/\s+/g, '-')}`}>{method}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => {
                setIsPaymentMethodDialogOpen(false);
                setSelectedBookingForPaymentUpdate(null);
                setPaymentReceivedMethodForDialog("");
            }}>Cancel</Button>
            <Button 
              onClick={handleConfirmPaymentAndUpdateStatus} 
              disabled={!paymentReceivedMethodForDialog || isUpdatingStatus === selectedBookingForPaymentUpdate?.id}
            >
              {isUpdatingStatus === selectedBookingForPaymentUpdate?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm & Complete Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
    
