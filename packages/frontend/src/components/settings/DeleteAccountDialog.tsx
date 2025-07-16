import { useState } from 'react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import authApiService, { DeleteAccountRequest } from '@/services/authApiService';
import { toast } from 'sonner';
import logger from '@/lib/logger';

interface DeleteAccountDialogProps {
  open: boolean;
  onClose: () => void;
}

export function DeleteAccountDialog({ open, onClose }: DeleteAccountDialogProps) {
  const { t } = useLanguage();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setConfirmEmail('');
    setPassword('');
    setError(null);
    onClose();
  };

  const handleDelete = async () => {
    if (!user?.email) {
      setError('User information not available');
      return;
    }

    // Validate email confirmation
    if (confirmEmail !== user.email) {
      setError(t('settings.emailConfirmError') || `Please type "${user.email}" to confirm`);
      return;
    }

    if (!password.trim()) {
      setError(t('settings.passwordRequired') || 'Password is required');
      return;
    }

    setError(null);
    setIsDeleting(true);

    try {
      const deleteData: DeleteAccountRequest = {
        username: confirmEmail,
        password: password,
      };

      await authApiService.deleteAccount(deleteData);

      logger.info('Account deleted successfully', { userId: user.id });
      toast.success(t('settings.accountDeleted') || 'Account deleted successfully');

      // Sign out user after successful deletion
      await signOut();

      // Explicitly navigate to home page
      navigate('/');

      handleClose();
    } catch (error: any) {
      logger.error('Error deleting account', { error });

      if (error.response?.status === 400) {
        setError(error.response.data.message || t('settings.deleteAccountError') || 'Failed to delete account');
      } else {
        setError(t('settings.deleteAccountError') || 'Failed to delete account');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            {t('settings.deleteAccount') || 'Delete Account'}
          </DialogTitle>
          <DialogDescription>
            {t('settings.deleteAccountDescription') ||
              'This action cannot be undone. This will permanently delete your account and remove all your data from our servers.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t('settings.deleteAccountWarning') ||
                'Warning: All your projects, images, and settings will be permanently deleted.'}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="confirm-email">{t('settings.confirmUsername') || `Type "${user?.email}" to confirm`}</Label>
            <Input
              id="confirm-email"
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={user?.email || ''}
              disabled={isDeleting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('settings.password') || 'Password'}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('settings.enterPassword') || 'Enter your password'}
              disabled={isDeleting}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting || !confirmEmail || !password}>
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isDeleting
              ? t('settings.deletingAccount') || 'Deleting Account...'
              : t('settings.deleteAccount') || 'Delete Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
