
import { db } from '@/lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import type { UserActivity, UserActivityEventType, UserActivityEventData } from '@/types/firestore';

export const logUserActivity = async (
  eventType: UserActivityEventType,
  eventData: UserActivityEventData,
  userId?: string | null,
  guestId?: string | null
): Promise<void> => {
  if (!userId && !guestId) {
    console.warn("ActivityLogger: Attempted to log activity without userId or guestId. Event:", eventType, eventData);
    return; // Don't log if no identifier
  }

  try {
    const activityData: Omit<UserActivity, 'id'> = {
      userId: userId || null,
      guestId: guestId || null,
      eventType,
      eventData,
      timestamp: Timestamp.now(),
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'server',
      // deviceType could be inferred client-side from userAgent if needed
    };

    await addDoc(collection(db, 'userActivities'), activityData);
    // console.log(`Activity logged: ${eventType}`, activityData);
  } catch (error) {
    console.error('Error logging user activity:', error, { eventType, eventData, userId, guestId });
  }
};
