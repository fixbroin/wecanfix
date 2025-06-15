
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Paperclip, UserCircle, MessageSquareText, Loader2 } from 'lucide-react';
import type { FirestoreUser, ChatMessage, ChatSession, FirestoreNotification } from '@/types/firestore';
import { Timestamp, doc, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, setDoc, serverTimestamp, getDoc, getDocs, limit } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { ADMIN_EMAIL } from '@/contexts/AuthContext';

interface AdminChatMessageAreaProps {
  selectedUser: FirestoreUser | null;
}

const ADMIN_FALLBACK_AVATAR_INITIAL_CHAT_AREA = "S";

export default function AdminChatMessageArea({ selectedUser }: AdminChatMessageAreaProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const scrollAreaRootRef = useRef<HTMLDivElement>(null);
  const { user: loggedInAdminUser } = useAuth();
  const { settings: globalSettings } = useGlobalSettings();

  const [supportAdminProfile, setSupportAdminProfile] = useState<{displayName?: string | null, photoURL?: string | null, uid: string | null}>({
    displayName: "Support", photoURL: null, uid: null
  });
  const [isLoadingSupportAdminProfile, setIsLoadingSupportAdminProfile] = useState(true);

  useEffect(() => {
    const fetchSupportAdminProfile = async () => {
      console.log("AdminChatMessageArea: Fetching support admin profile...");
      setIsLoadingSupportAdminProfile(true);
      try {
        const adminQuery = query(collection(db, "users"), where("email", "==", ADMIN_EMAIL), limit(1));
        const adminSnapshot = await getDocs(adminQuery);
        if (!adminSnapshot.empty) {
          const adminData = adminSnapshot.docs[0].data();
          const adminUid = adminSnapshot.docs[0].id;
          console.log("AdminChatMessageArea: Support admin profile found:", { displayName: adminData.displayName, uid: adminUid });
          setSupportAdminProfile({
            displayName: adminData.displayName || "Support",
            photoURL: adminData.photoURL || null,
            uid: adminUid
          });
        } else {
          console.warn(`AdminChatMessageArea: Admin user with email ${ADMIN_EMAIL} not found for chat. Using fallback UID.`);
          setSupportAdminProfile({ displayName: "Support", photoURL: null, uid: 'fallback_admin_uid' });
        }
      } catch (error) {
        console.error("AdminChatMessageArea: Error fetching support admin profile:", error);
        setSupportAdminProfile({ displayName: "Support", photoURL: null, uid: 'fallback_admin_uid' });
      } finally {
        setIsLoadingSupportAdminProfile(false);
        console.log("AdminChatMessageArea: Finished fetching support admin profile.");
      }
    };
    fetchSupportAdminProfile();
  }, []);

  const getChatSessionId = useCallback((userId1: string, userId2: string): string => {
    return [userId1, userId2].sort().join('_');
  }, []);

  const currentChatSessionId = selectedUser && supportAdminProfile.uid ? getChatSessionId(selectedUser.id, supportAdminProfile.uid) : null;
  console.log("AdminChatMessageArea: currentChatSessionId is:", currentChatSessionId, "Selected User:", selectedUser?.id, "Support Admin UID:", supportAdminProfile.uid);

  useEffect(() => {
    if (currentChatSessionId && selectedUser && !isLoadingSupportAdminProfile) {
      console.log(`AdminChatMessageArea: Subscribing to messages for session ${currentChatSessionId}`);
      setIsLoadingMessages(true);
      const messagesRef = collection(db, 'chats', currentChatSessionId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'asc'));

      const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        console.log(`AdminChatMessageArea: Messages snapshot received for ${currentChatSessionId}, count: ${querySnapshot.docs.length}`);
        const fetchedMessages = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ChatMessage));
        setMessages(fetchedMessages);
        setIsLoadingMessages(false);

        for (const msg of fetchedMessages) {
          if (msg.senderType === 'user' && !msg.isReadByAdmin && msg.id) {
            const msgRef = doc(db, 'chats', currentChatSessionId, 'messages', msg.id);
            await updateDoc(msgRef, { isReadByAdmin: true });
          }
        }
        const sessionDocRef = doc(db, 'chats', currentChatSessionId);
        const sessionSnap = await getDoc(sessionDocRef);
        if (sessionSnap.exists()) {
            await updateDoc(sessionDocRef, { adminUnreadCount: 0, updatedAt: serverTimestamp() });
        } else if (selectedUser && supportAdminProfile.uid) {
             console.log("AdminChatMessageArea: Creating new chat session document for", currentChatSessionId);
            await setDoc(sessionDocRef, {
                userId: selectedUser.id,
                adminId: supportAdminProfile.uid,
                adminUnreadCount: 0,
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp(),
                participants: [selectedUser.id, supportAdminProfile.uid].filter(Boolean),
            }, { merge: true });
        }

        const lastMessage = fetchedMessages[fetchedMessages.length - 1];
        if (globalSettings?.chatNotificationSoundUrl && lastMessage && lastMessage.senderType === 'user' && !lastMessage.isReadByAdmin && messages.length > 0) {
           // console.log("TODO: Play admin notification sound for new user message", globalSettings.chatNotificationSoundUrl);
        }

      }, (error) => {
        console.error(`AdminChatMessageArea: Error fetching messages for session ${currentChatSessionId}:`, error);
        setIsLoadingMessages(false);
      });

      return () => {
        console.log(`AdminChatMessageArea: Unsubscribing from messages for session ${currentChatSessionId}`);
        unsubscribe();
      };
    } else {
      console.log("AdminChatMessageArea: Not subscribing to messages. currentChatSessionId:", currentChatSessionId, "selectedUser:", !!selectedUser, "isLoadingSupportAdminProfile:", isLoadingSupportAdminProfile);
      setMessages([]);
      if (!isLoadingSupportAdminProfile) setIsLoadingMessages(false);
    }
  }, [currentChatSessionId, selectedUser, isLoadingSupportAdminProfile, supportAdminProfile.uid, globalSettings?.chatNotificationSoundUrl, messages.length]);

  useEffect(() => {
    if (scrollAreaRootRef.current) {
      const viewport = scrollAreaRootRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, isLoadingMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser || !loggedInAdminUser || !currentChatSessionId || !supportAdminProfile.uid) {
      console.log("AdminChatMessageArea: Send message pre-condition failed. Message:", newMessage, "Selected User:", !!selectedUser, "Logged In Admin:", !!loggedInAdminUser, "Session ID:", currentChatSessionId, "Support Admin UID:", supportAdminProfile.uid);
      return;
    }

    const messageData: Omit<ChatMessage, 'id'> = {
      chatSessionId: currentChatSessionId,
      senderId: supportAdminProfile.uid,
      senderType: 'admin',
      text: newMessage,
      timestamp: Timestamp.now(),
      isReadByUser: false,
    };

    const tempNewMessage = newMessage;
    setNewMessage('');
    try {
      console.log(`AdminChatMessageArea: Attempting to send message for session ${currentChatSessionId}`);
      const messagesRef = collection(db, 'chats', currentChatSessionId, 'messages');
      await addDoc(messagesRef, messageData);

      const sessionDocRef = doc(db, 'chats', currentChatSessionId);
      const sessionSnap = await getDoc(sessionDocRef);
      const currentSessionData = sessionSnap.exists() ? sessionSnap.data() as ChatSession : undefined;
      const currentUserUnreadCount = currentSessionData?.userUnreadCount || 0;

      await setDoc(sessionDocRef, {
        userId: selectedUser.id,
        userName: selectedUser.displayName || null,
        userPhotoUrl: selectedUser.photoURL || null,
        adminId: supportAdminProfile.uid,
        adminName: supportAdminProfile.displayName || null,
        adminPhotoUrl: supportAdminProfile.photoURL || null,
        lastMessageText: tempNewMessage.substring(0, 50),
        lastMessageTimestamp: messageData.timestamp,
        lastMessageSenderId: supportAdminProfile.uid,
        participants: [selectedUser.id, supportAdminProfile.uid].filter(p => p !== null),
        userUnreadCount: currentUserUnreadCount + 1,
        adminUnreadCount: 0,
        updatedAt: messageData.timestamp,
        ...(currentSessionData ? {} : { createdAt: messageData.timestamp })
      }, { merge: true });
      console.log(`AdminChatMessageArea: Session doc updated for ${currentChatSessionId}`);

      const userNotificationData: FirestoreNotification = {
        userId: selectedUser.id,
        title: `New Message from ${supportAdminProfile.displayName || "Support"}`,
        message: `You have a new chat message: "${tempNewMessage.substring(0, 30)}${tempNewMessage.length > 30 ? "..." : ""}"`,
        type: 'info',
        href: '/chat',
        read: false,
        createdAt: Timestamp.now(),
      };
      await addDoc(collection(db, "userNotifications"), userNotificationData);
      console.log("AdminChatMessageArea: User notification created for", selectedUser.id);


      console.log("TODO: Send push notification for new admin message to user:", selectedUser.id);

    } catch (error) {
      console.error("AdminChatMessageArea: Error sending message:", error);
    }
  };

  if (!selectedUser) {
    return (
      <Card className="h-full flex flex-col items-center justify-center text-center shadow-md">
        <CardContent className="p-6">
          <MessageSquareText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Select a user from the list to view their chat history or send a message.</p>
        </CardContent>
      </Card>
    );
  }

  if (!loggedInAdminUser || isLoadingSupportAdminProfile || !supportAdminProfile.uid) {
    return <Card className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2"/> <p className="text-muted-foreground">Loading admin details...</p></Card>;
  }

  return (
    <Card className="h-full flex flex-col shadow-md">
      <CardHeader className="p-4 border-b">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={selectedUser.photoURL || undefined} alt={selectedUser.displayName || selectedUser.email?.charAt(0) || 'U'} />
            <AvatarFallback>
                {selectedUser.displayName ? selectedUser.displayName.charAt(0).toUpperCase() : selectedUser.email ? selectedUser.email.charAt(0).toUpperCase() : <UserCircle size={20}/>}
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-md">{selectedUser.displayName || selectedUser.email}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-grow overflow-hidden"> {/* Changed: Added flex-grow and overflow-hidden */}
        <ScrollArea className="h-full p-4" ref={scrollAreaRootRef}> {/* Changed: ScrollArea takes h-full of its parent (CardContent) */}
          {isLoadingMessages ? (
             <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : messages.length === 0 ? (
             <div className="flex justify-center items-center h-full">
                <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
             </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-end space-x-2 ${
                    msg.senderType === 'admin' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.senderType === 'user' && (
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={selectedUser.photoURL || undefined} />
                      <AvatarFallback>{selectedUser.displayName ? selectedUser.displayName.charAt(0).toUpperCase() : selectedUser.email ? selectedUser.email.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[70%] p-2.5 rounded-lg shadow-sm ${
                      msg.senderType === 'admin'
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-card border rounded-bl-none'
                    }`}
                  >
                    {msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
                    <p className="text-xs text-muted-foreground/80 mt-1 text-right">
                      {msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {msg.senderType === 'admin' && (
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={supportAdminProfile?.photoURL || undefined} />
                      <AvatarFallback>{supportAdminProfile?.displayName ? supportAdminProfile.displayName.charAt(0).toUpperCase() : ADMIN_FALLBACK_AVATAR_INITIAL_CHAT_AREA}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t">
        <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-grow h-10"
            autoComplete="off"
            disabled={isLoadingMessages || isLoadingSupportAdminProfile}
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim() || isLoadingMessages || isLoadingSupportAdminProfile}>
            <Send className="h-5 w-5" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}

