
import React from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from '@/contexts/LanguageContext';

const NotificationSection = () => {
  const { t } = useLanguage();
  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success(t('settings.notificationSettingsSaved'));
  };

  return (
    <form onSubmit={handleSaveNotifications}>
      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">{t('settings.emailNotifications')}</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="emailUpdates">{t('settings.notifications.projectUpdates')}</Label>
                <p className="text-sm text-gray-500">{t('settings.notifications.receiveProjectUpdates')}</p>
              </div>
              <Switch id="emailUpdates" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="emailResults">{t('settings.notifications.segmentationResults')}</Label>
                <p className="text-sm text-gray-500">{t('settings.notifications.receiveSegmentationResults')}</p>
              </div>
              <Switch id="emailResults" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="emailMarketing">{t('settings.notifications.newsletterUpdates')}</Label>
                <p className="text-sm text-gray-500">{t('settings.notifications.receiveNewsletterUpdates')}</p>
              </div>
              <Switch id="emailMarketing" />
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-medium">{t('settings.inAppNotifications')}</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="appCollaborations">{t('settings.notifications.collaborationRequests')}</Label>
                <p className="text-sm text-gray-500">{t('settings.notifications.receiveCollaborationRequests')}</p>
              </div>
              <Switch id="appCollaborations" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="appComments">{t('settings.notifications.commentsMentions')}</Label>
                <p className="text-sm text-gray-500">{t('settings.notifications.receiveCommentsMentions')}</p>
              </div>
              <Switch id="appComments" defaultChecked />
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button type="submit">{t('settings.savePreferences')}</Button>
        </div>
      </div>
    </form>
  );
};

export default NotificationSection;
