import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, UserPlus, X, Eye, Edit, Trash, Link, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import apiClient from '@/lib/apiClient';
import { useLanguage } from '@/contexts/LanguageContext';

interface ShareDialogProps {
  projectId: string;
  projectName: string;
  isOwner: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Validation schema for sharing form - will be created inside component
const createShareFormSchema = (t: any) =>
  z.object({
    email: z.string().email({ message: t('share.invalidEmail') || 'Invalid email address' }),
    permission: z.enum(['view', 'edit'], {
      required_error: t('share.selectPermission') || 'Please select a permission type',
    }),
  });

type ShareFormValues = {
  email: string;
  permission: 'view' | 'edit';
};

// Typ pro sdílené uživatele
interface SharedUser {
  id: string;
  email: string;
  permission: 'view' | 'edit';
  userName?: string;
  user_name?: string; // Backend returns snake_case
  is_pending: boolean; // Backend returns snake_case
  isPending?: boolean; // For frontend compatibility
}

const ShareDialog: React.FC<ShareDialogProps> = ({ projectId, projectName, isOwner, open, onOpenChange }) => {
  const { t } = useLanguage();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  const [isLoading, setIsLoading] = useState(false);
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const [isLoadingShares, setIsLoadingShares] = useState(false);
  const [invitationLink, setInvitationLink] = useState<string>('');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [linkPermission, setLinkPermission] = useState<'view' | 'edit'>('view');

  // Initialize React Hook Form with translated schema
  const shareFormSchema = createShareFormSchema(t);
  const form = useForm<ShareFormValues>({
    resolver: zodResolver(shareFormSchema),
    defaultValues: {
      email: '',
      permission: 'view',
    },
  });

  // Při otevření dialogu načte sdílené uživatele
  useEffect(() => {
    if (isOpen && isOwner) {
      fetchSharedUsers();
    }
  }, [isOpen, projectId, isOwner]);

  // Funkce pro získání seznamu uživatelů se kterými je projekt sdílen
  const fetchSharedUsers = async () => {
    if (!isOwner) return;

    setIsLoadingShares(true);
    try {
      const response = await apiClient.get(`/api/project-shares/${projectId}`);
      // Convert snake_case to camelCase for frontend compatibility
      const users = response.data.data.map((user: any) => ({
        ...user,
        isPending: user.is_pending,
        userName: user.user_name || user.userName,
      }));
      setSharedUsers(users);
    } catch (error) {
      console.error('Error fetching shared users:', error);
      // Silently fail - don't show error toast, just set empty array
      setSharedUsers([]);
    } finally {
      setIsLoadingShares(false);
    }
  };

  // Funkce pro zpracování formuláře
  const onSubmit = async (values: ShareFormValues) => {
    setIsLoading(true);
    try {
      await apiClient.post(`/api/project-shares/${projectId}`, values);
      toast.success(
        t('share.sharedSuccess', { projectName, email: values.email }) ||
          `Project "${projectName}" has been shared with ${values.email}`,
      );
      form.reset();
      fetchSharedUsers(); // Po úspěšném sdílení znovu načteme seznam sdílených uživatelů
    } catch (error: any) {
      console.error('Error sharing project:', error);

      // Zpracování různých typů chyb
      if (error.response?.status === 409) {
        toast.error(t('share.alreadyShared') || 'Project is already shared with this user');
      } else if (error.response?.status === 400) {
        toast.error(t('share.invalidEmailOrPermission') || 'Invalid email or permission');
      } else if (error.response?.status === 404) {
        toast.error(t('share.projectNotFound') || 'Project not found');
      } else {
        toast.error(t('share.failedToShare') || 'Failed to share project');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Funkce pro odebrání sdílení
  const handleRemoveShare = async (shareId: string, email: string) => {
    try {
      await apiClient.delete(`/api/project-shares/${projectId}/${shareId}`);
      toast.success(t('share.removedSuccess', { email }) || `Share with ${email} has been removed`);
      fetchSharedUsers(); // Po úspěšném odebrání znovu načteme seznam sdílených uživatelů
    } catch (error) {
      console.error('Error removing share:', error);
      toast.error(t('share.failedToRemove') || 'Failed to remove share');
    }
  };

  // Funkce pro generování invitation linku
  const generateInvitationLink = async () => {
    setIsGeneratingLink(true);
    try {
      const response = await apiClient.post(`/api/project-shares/${projectId}/invitation-link`, {
        permission: linkPermission,
      });
      setInvitationLink(response.data.data.invitationUrl);
      toast.success(t('share.linkGenerated') || 'Invitation link has been generated');
    } catch (error) {
      console.error('Error generating invitation link:', error);
      toast.error(t('share.failedToGenerateLink') || 'Failed to generate invitation link');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  // Funkce pro kopírování linku do schránky
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(invitationLink);
      toast.success(t('share.linkCopied') || 'Link copied to clipboard');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error(t('share.failedToCopy') || 'Failed to copy link');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('share.shareProjectTitle', { projectName }) || `Share project "${projectName}"`}</DialogTitle>
          <DialogDescription>
            {t('share.shareDescription') || 'Invite other users to collaborate on this project.'}
          </DialogDescription>
        </DialogHeader>

        {isOwner ? (
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">
                <Mail className="h-4 w-4 mr-2" />
                {t('share.inviteByEmail') || 'Invite by email'}
              </TabsTrigger>
              <TabsTrigger value="link">
                <Link className="h-4 w-4 mr-2" />
                {t('share.inviteByLink') || 'Invitation link'}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="space-y-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="flex space-x-2">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder={t('share.userEmail') || 'User email'}
                                className="pl-8"
                                {...field}
                                disabled={isLoading}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('share.sharing') || 'Sharing...'}
                        </>
                      ) : (
                        <>
                          <UserPlus className="mr-2 h-4 w-4" />
                          {t('share.invite') || 'Invite'}
                        </>
                      )}
                    </Button>
                  </div>

                  <FormField
                    control={form.control}
                    name="permission"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('share.permissions') || 'Permissions'}</FormLabel>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          disabled={isLoading}
                          className="flex space-x-4"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="view" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              <Eye className="h-4 w-4 inline mr-1" />
                              {t('share.viewOnly') || 'View only'}
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="edit" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              <Edit className="h-4 w-4 inline mr-1" />
                              {t('share.canEdit') || 'Can edit'}
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                        <FormDescription>
                          {t('share.selectAccessLevel') || 'Select access level for this user'}
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </form>
              </Form>

              <Separator />

              <div>
                <h3 className="text-sm font-medium mb-2">{t('share.sharedWith') || 'Shared with'}</h3>

                {isLoadingShares ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : sharedUsers.length > 0 ? (
                  <div className="border rounded-md max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('share.email') || 'Email'}</TableHead>
                          <TableHead>{t('share.permissions') || 'Permissions'}</TableHead>
                          <TableHead>{t('share.status') || 'Status'}</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sharedUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.email}</TableCell>
                            <TableCell>
                              {user.permission === 'view' ? (
                                <span className="flex items-center">
                                  <Eye className="h-3 w-3 mr-1" />
                                  {t('share.view') || 'View'}
                                </span>
                              ) : (
                                <span className="flex items-center">
                                  <Edit className="h-3 w-3 mr-1" />
                                  {t('share.edit') || 'Edit'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {user.isPending ? (
                                <span className="text-amber-500 text-xs">
                                  {t('share.pendingAcceptance') || 'Pending acceptance'}
                                </span>
                              ) : (
                                <span className="text-green-500 text-xs">{t('share.accepted') || 'Accepted'}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveShare(user.id, user.email)}
                                title={t('share.removeShare') || 'Remove share'}
                              >
                                <Trash className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {t('share.noShares') || 'This project is not shared with anyone yet'}
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="link" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('share.linkPermissions') || 'Link permissions'}</label>
                  <RadioGroup
                    value={linkPermission}
                    onValueChange={(value) => setLinkPermission(value as 'view' | 'edit')}
                    className="flex space-x-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="view" />
                      <label className="font-normal cursor-pointer">
                        <Eye className="h-4 w-4 inline mr-1" />
                        {t('share.viewOnly') || 'View only'}
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="edit" />
                      <label className="font-normal cursor-pointer">
                        <Edit className="h-4 w-4 inline mr-1" />
                        {t('share.canEdit') || 'Can edit'}
                      </label>
                    </div>
                  </RadioGroup>
                </div>

                {!invitationLink ? (
                  <Button onClick={generateInvitationLink} disabled={isGeneratingLink} className="w-full">
                    {isGeneratingLink ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('share.generating') || 'Generating...'}
                      </>
                    ) : (
                      <>
                        <Link className="mr-2 h-4 w-4" />
                        {t('share.generateLink') || 'Generate invitation link'}
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {t('share.shareLinkDescription') ||
                        'Share this link with users you want to give access to the project:'}
                    </p>
                    <div className="flex space-x-2">
                      <Input value={invitationLink} readOnly className="flex-1" />
                      <Button
                        onClick={copyToClipboard}
                        size="icon"
                        variant="outline"
                        title={t('share.copyToClipboard') || 'Copy to clipboard'}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      onClick={() => {
                        setInvitationLink('');
                        generateInvitationLink();
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      <Link className="mr-2 h-4 w-4" />
                      {t('share.generateNewLink') || 'Generate new link'}
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-medium mb-2">{t('share.sharedWith') || 'Shared with'}</h3>

                {isLoadingShares ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : sharedUsers.length > 0 ? (
                  <div className="border rounded-md max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('share.email') || 'Email'}</TableHead>
                          <TableHead>{t('share.permissions') || 'Permissions'}</TableHead>
                          <TableHead>{t('share.status') || 'Status'}</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sharedUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.email}</TableCell>
                            <TableCell>
                              {user.permission === 'view' ? (
                                <span className="flex items-center">
                                  <Eye className="h-3 w-3 mr-1" />
                                  {t('share.view') || 'View'}
                                </span>
                              ) : (
                                <span className="flex items-center">
                                  <Edit className="h-3 w-3 mr-1" />
                                  {t('share.edit') || 'Edit'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {user.isPending ? (
                                <span className="text-amber-500 text-xs">
                                  {t('share.pendingAcceptance') || 'Pending acceptance'}
                                </span>
                              ) : (
                                <span className="text-green-500 text-xs">{t('share.accepted') || 'Accepted'}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveShare(user.id, user.email)}
                                title={t('share.removeShare') || 'Remove share'}
                              >
                                <Trash className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {t('share.noShares') || 'This project is not shared with anyone yet'}
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <p className="text-center py-4">
            {t('share.noPermission') || 'You do not have permission to share this project.'}
          </p>
        )}

        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
            <X className="mr-2 h-4 w-4" />
            {t('common.close') || 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;
