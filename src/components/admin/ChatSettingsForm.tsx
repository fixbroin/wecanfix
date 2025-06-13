
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Loader2, Save, Volume2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, Timestamp } from "firebase/firestore";
import type { GlobalWebSettings } from '@/types/firestore';
import { useGlobalSettings } from '@/hooks/useGlobalSettings'; // Import the hook

const chatSettingsFormSchema = z.object({
  isChatEnabled: z.boolean().default(false),
  chatNotificationSoundUrl: z.string().url({ message: "Must be a valid URL if provided." }).optional().or(z.literal('')),
});

type ChatSettingsFormData = z.infer<typeof chatSettingsFormSchema>;

export default function ChatSettingsForm() {
  const { toast } = useToast();
  const { settings: globalSettings, isLoading: isLoadingGlobalSettings } = useGlobalSettings();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ChatSettingsFormData>({
    resolver: zodResolver(chatSettingsFormSchema),
    defaultValues: {
      isChatEnabled: false,
      chatNotificationSoundUrl: "",
    },
  });

  useEffect(() => {
    if (globalSettings && !isLoadingGlobalSettings) {
      form.reset({
        isChatEnabled: globalSettings.isChatEnabled || false,
        chatNotificationSoundUrl: globalSettings.chatNotificationSoundUrl || "",
      });
    }
  }, [globalSettings, isLoadingGlobalSettings, form]);

  const onSubmit = async (data: ChatSettingsFormData) => {
    setIsSaving(true);
    try {
      const settingsDocRef = doc(db, "webSettings", "global");
      const settingsToUpdate: Partial<GlobalWebSettings> = {
        isChatEnabled: data.isChatEnabled,
        chatNotificationSoundUrl: data.chatNotificationSoundUrl,
        updatedAt: Timestamp.now(),
      };
      await setDoc(settingsDocRef, settingsToUpdate, { merge: true });
      toast({ title: "Success", description: "Chat settings saved successfully." });
    } catch (error) {
      console.error("Error saving chat settings:", error);
      toast({ title: "Error", description: "Could not save chat settings.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingGlobalSettings) {
    return (
      <Card>
        <CardHeader><CardTitle>Chat Feature Configuration</CardTitle></CardHeader>
        <CardContent className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Loading chat settings...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Chat Feature Configuration</CardTitle>
            <CardDescription>Enable or disable the frontend chat widget and set notification sound.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="isChatEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Enable Chat Feature</FormLabel>
                    <FormDescription>
                      Show a chat button on the frontend for users to interact with admin.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSaving}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="chatNotificationSoundUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    <Volume2 className="mr-2 h-4 w-4 text-muted-foreground" />
                    Notification Sound URL (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., https://example.com/sounds/new_message.mp3" {...field} disabled={isSaving} />
                  </FormControl>
                  <FormDescription>
                    Direct URL to an MP3 or WAV file for new message alerts in the admin panel.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Chat Settings
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
