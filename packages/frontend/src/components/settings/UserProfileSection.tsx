import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';
import axios from 'axios';
import AvatarUploader from './AvatarUploader';
import { showSuccess, showError, showInfo } from '@/utils/toastUtils';

// Type for data coming from the backend (matches UserProfile in Settings.tsx)
interface UserProfileData {
  username: string | null;
  full_name: string | null;
  title: string | null;
  organization: string | null;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  // Add other fields if necessary
}

// Schema for the form validation
const profileFormSchema = z.object({
  username: z.string().min(2, 'Username must be at least 2 characters.').max(50).optional(),
  full_name: z.string().max(100).optional(), // Add full_name
  title: z.string().max(100).optional(),
  organization: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  // avatar_url is typically handled separately
});

// Type inferred from the schema for form values
type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface UserProfileSectionProps {
  userId: string; // Keep userId if needed for context, though PUT /users/me uses token
  profile: UserProfileData;
}

const UserProfileSection: React.FC<UserProfileSectionProps> = ({ profile }) => {
  const { t } = useLanguage();
  const { updateProfile } = useProfile();
  const [isLoading, setIsLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [hasAvatarChanges, setHasAvatarChanges] = useState(false);
  const [avatarUploadFn, setAvatarUploadFn] = useState<(() => Promise<void>) | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      username: profile.username || '',
      full_name: profile.full_name || '', // Use full_name from profile
      title: profile.title || '',
      organization: profile.organization || '',
      bio: profile.bio || '',
      location: profile.location || '',
    },
    mode: 'onChange',
  });

  // Handle avatar change
  const handleAvatarChange = (newAvatarUrl: string, hasChanges: boolean) => {
    setAvatarUrl(newAvatarUrl);
    setHasAvatarChanges(hasChanges);
  };

  // Handle avatar upload function from AvatarUploader
  const handleAvatarUploadRequest = (uploadFn: () => Promise<void>) => {
    setAvatarUploadFn(() => uploadFn);
  };

  async function onSubmit(data: ProfileFormValues) {
    setIsLoading(true);

    try {
      // First, upload avatar if there are pending changes
      if (hasAvatarChanges && avatarUploadFn) {
        console.log('Uploading avatar changes...');
        await avatarUploadFn();
        setHasAvatarChanges(false);
        setAvatarUploadFn(null);
      }

      // Prepare profile data for the API PUT /users/me
      // Only include fields that are part of the form schema and are not empty strings
      // This prevents sending empty or invalid fields that could cause backend errors
      const dataToSend: Partial<ProfileFormValues> = {};
      if (data.username && data.username.trim() !== '') dataToSend.username = data.username.trim();
      if (data.full_name && data.full_name.trim() !== '') dataToSend.full_name = data.full_name.trim();
      if (data.title && data.title.trim() !== '') dataToSend.title = data.title.trim();
      if (data.organization && data.organization.trim() !== '') dataToSend.organization = data.organization.trim();
      if (data.bio && data.bio.trim() !== '') dataToSend.bio = data.bio.trim();
      if (data.location && data.location.trim() !== '') dataToSend.location = data.location.trim();
      // avatar_url and preferred_language are not in this form

      // Check if there are form changes or avatar changes
      const hasFormChanges = Object.keys(dataToSend).length > 0;
      
      if (!hasFormChanges && !hasAvatarChanges) {
        showInfo(t('settings.noChanges') || 'No changes to save');
        setIsLoading(false);
        return;
      }

      // Only update profile if there are form changes
      if (hasFormChanges) {
        // Implement a client-side simulation of profile update
        console.log('Simulating profile update with data:', dataToSend);

        // Store the profile data in localStorage
        const currentProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        const updatedProfile = { ...currentProfile, ...dataToSend };
        localStorage.setItem('userProfile', JSON.stringify(updatedProfile));

        // Update profile context
        updateProfile(dataToSend);

        console.log('Profile updated in localStorage and context:', updatedProfile);
      }

      showSuccess(t('settings.updateSuccess') || 'Profile updated successfully!');
      form.reset(data); // Reset form with new default values to clear dirty state
    } catch (error: unknown) {
      console.error('Error updating profile:', error);
      let errorMessage = t('settings.updateError') || 'Failed to update profile.';
      let statusCode: number | undefined;

      // Check if it's an AxiosError to access response details safely
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data?.message || errorMessage;
        statusCode = error.response.status;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Handle specific errors like username taken (409)
      if (statusCode === 409) {
        form.setError('username', {
          type: 'manual',
          message: t('settings.usernameTaken'),
        });
      } else {
        showError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.title')}</CardTitle>
        <CardDescription>{t('profile.description')}</CardDescription>
        <div className="mt-4 flex justify-center">
          <AvatarUploader 
            currentAvatarUrl={avatarUrl} 
            onAvatarChange={handleAvatarChange} 
            onUploadRequest={handleAvatarUploadRequest}
            size="lg" 
          />
        </div>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <CardContent className="space-y-4">
            {/* Username Field */}
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('profile.username')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('profile.usernamePlaceholder')} {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Full Name Field */}
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('profile.fullName')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('profile.fullNamePlaceholder')} {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Title Field */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('profile.title')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('profile.titlePlaceholder')} {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Organization Field */}
            <FormField
              control={form.control}
              name="organization"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('profile.organization')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('profile.organizationPlaceholder')} {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Bio Field */}
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('profile.bio')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t('profile.bioPlaceholder')} {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormDescription>{t('profile.bioDescription')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Location Field */}
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('profile.location')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('profile.locationPlaceholder')} {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            {/* Disable button if form is not dirty AND no avatar changes */}
            <Button type="submit" disabled={isLoading || (!form.formState.isDirty && !hasAvatarChanges)}>
              {isLoading ? t('common.saving') + '...' : t('profile.saveButton')}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
};

export default UserProfileSection;
