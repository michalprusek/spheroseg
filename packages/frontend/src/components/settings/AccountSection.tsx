import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, AlertTriangle, Lock, Trash2 } from 'lucide-react';
import authApiService, { ChangePasswordRequest } from '@/services/authApiService';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import logger from '@/lib/logger';

// Password change form schema - use a function to create schema with translated messages
const createPasswordChangeSchema = (t: (key: string) => string) => z.object({
  current_password: z.string().min(1, t('settings.currentPassword') || 'Current password is required'),
  new_password: z.string().min(8, t('settings.newPassword') + ' must be at least 8 characters' || 'New password must be at least 8 characters'),
  confirm_password: z.string().min(8, t('settings.confirmPasswordLabel') || 'Password confirmation is required'),
}).refine((data) => data.new_password === data.confirm_password, {
  message: t('settings.passwordsDoNotMatch') || 'Passwords do not match',
  path: ['confirm_password'],
});

const AccountSection = () => {
  const { t } = useLanguage();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const passwordChangeSchema = createPasswordChangeSchema(t);
  type PasswordChangeForm = z.infer<typeof passwordChangeSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
  } = useForm<PasswordChangeForm>({
    resolver: zodResolver(passwordChangeSchema),
    mode: 'onChange',
  });

  const handlePasswordChange = async (data: PasswordChangeForm) => {
    setPasswordError(null);
    setIsChangingPassword(true);

    try {
      const changeData: ChangePasswordRequest = {
        current_password: data.current_password,
        new_password: data.new_password,
        confirm_password: data.confirm_password,
      };

      await authApiService.changePassword(changeData);
      
      logger.info('Password changed successfully');
      toast.success(t('settings.passwordChanged') || 'Password changed successfully');
      
      // Clear the form
      reset();
    } catch (error: any) {
      logger.error('Error changing password', { error });
      
      if (error.response?.status === 400) {
        setPasswordError(error.response.data.message || t('settings.passwordChangeError') || 'Failed to change password');
      } else {
        setPasswordError(t('settings.passwordChangeError') || 'Failed to change password');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Password Change Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t('settings.changePassword') || 'Change Password'}
          </CardTitle>
          <CardDescription>
            {t('settings.changePasswordDescription') || 'Update your password to keep your account secure.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(handlePasswordChange)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="current_password">{t('settings.currentPassword') || 'Current Password'}</Label>
                <Input
                  id="current_password"
                  type="password"
                  {...register('current_password')}
                  disabled={isChangingPassword}
                />
                {errors.current_password && (
                  <p className="text-sm text-destructive">{errors.current_password.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new_password">{t('settings.newPassword') || 'New Password'}</Label>
                <Input
                  id="new_password"
                  type="password"
                  {...register('new_password')}
                  disabled={isChangingPassword}
                />
                {errors.new_password && (
                  <p className="text-sm text-destructive">{errors.new_password.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm_password">{t('settings.confirmNewPassword') || 'Confirm New Password'}</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  {...register('confirm_password')}
                  disabled={isChangingPassword}
                />
                {errors.confirm_password && (
                  <p className="text-sm text-destructive">{errors.confirm_password.message}</p>
                )}
              </div>
            </div>

            {passwordError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={!isValid || isChangingPassword}
              >
                {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isChangingPassword 
                  ? (t('settings.changingPassword') || 'Changing Password...') 
                  : (t('settings.changePassword') || 'Change Password')
                }
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone Section */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            {t('settings.dangerZone') || 'Danger Zone'}
          </CardTitle>
          <CardDescription>
            {t('settings.dangerZoneDescription') || 'Irreversible and destructive actions.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 border border-destructive/20 bg-destructive/5 rounded-md">
            <h4 className="font-medium mb-2 text-destructive">
              {t('settings.deleteAccount') || 'Delete Account'}
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              {t('settings.deleteAccountWarning') || 
               'Once you delete your account, there is no going back. Please be certain.'}
            </p>
            <Button 
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              {t('settings.deleteAccount') || 'Delete Account'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account Dialog */}
      <DeleteAccountDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
};

export default AccountSection;
