import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslations } from '../hooks/useTranslations';
import ImageUploader from './ImageUploader';

interface ProfileFormData {
  username: string;
  fullName: string;
  title: string;
  organization: string;
  bio: string;
  location: string;
  preferredLanguage: string;
  themePreference: string;
}

const Profile: React.FC = () => {
  const { user, updateUserProfile, isLoading } = useAuth();
  const { t, changeLanguage, currentLanguage } = useTranslations();
  const [formData, setFormData] = useState<ProfileFormData>({
    username: user?.username || '',
    fullName: user?.full_name || '',
    title: user?.title || '',
    organization: user?.organization || '',
    bio: user?.bio || '',
    location: user?.location || '',
    preferredLanguage: user?.preferred_language || currentLanguage,
    themePreference: user?.theme_preference || 'system',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // Update form data when user data changes
  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        fullName: user.full_name || '',
        title: user.title || '',
        organization: user.organization || '',
        bio: user.bio || '',
        location: user.location || '',
        preferredLanguage: user.preferred_language || currentLanguage,
        themePreference: user.theme_preference || 'system',
      });
    }
  }, [user, currentLanguage]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Apply language change immediately
    if (name === 'preferredLanguage' && value !== currentLanguage) {
      changeLanguage(value);
    }
  };

  const handleAvatarUpload = (file: File) => {
    setAvatarFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      // Create form data for multipart upload (for avatar)
      const profileData = new FormData();

      // Add all text fields
      Object.entries(formData).forEach(([key, value]) => {
        profileData.append(key, value);
      });

      // Add avatar if selected
      if (avatarFile) {
        profileData.append('avatar', avatarFile);
      }

      // Update profile through auth context
      await updateUserProfile(profileData);

      setSuccessMessage(t('profile.updateSuccess'));
      setAvatarFile(null); // Clear avatar selection after successful update
    } catch (error) {
      console.error('Profile update error:', error);
      setErrorMessage(t('profile.updateError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="loading-indicator">{t('common.loading')}</div>;
  }

  return (
    <div className="profile-container">
      <h2 className="profile-title">{t('profile.title')}</h2>

      {successMessage && <div className="success-message">{successMessage}</div>}

      {errorMessage && <div className="error-message">{errorMessage}</div>}

      <form onSubmit={handleSubmit} className="profile-form">
        <div className="form-section">
          <h3>{t('profile.personalInfo')}</h3>

          <div className="avatar-section">
            <label>{t('profile.avatar')}</label>
            <div className="avatar-wrapper">
              {user?.avatar_url && (
                <img src={user.avatar_url} alt={t('profile.avatarAlt')} className="current-avatar" />
              )}
              <ImageUploader
                onImageUpload={handleAvatarUpload}
                maxSize={2 * 1024 * 1024} // 2MB
                accept={['image/jpeg', 'image/png']}
                dropzoneText={t('profile.dropzoneText')}
                buttonText={t('profile.selectAvatar')}
                className="avatar-uploader"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="username">{t('profile.username')}</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder={t('profile.usernamePlaceholder')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="fullName">{t('profile.fullName')}</label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              placeholder={t('profile.fullNamePlaceholder')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="bio">{t('profile.bio')}</label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              placeholder={t('profile.bioPlaceholder')}
              rows={4}
            />
          </div>
        </div>

        <div className="form-section">
          <h3>{t('profile.professional')}</h3>

          <div className="form-group">
            <label htmlFor="title">{t('profile.title')}</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder={t('profile.titlePlaceholder')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="organization">{t('profile.organization')}</label>
            <input
              type="text"
              id="organization"
              name="organization"
              value={formData.organization}
              onChange={handleInputChange}
              placeholder={t('profile.organizationPlaceholder')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="location">{t('profile.location')}</label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder={t('profile.locationPlaceholder')}
            />
          </div>
        </div>

        <div className="form-section">
          <h3>{t('profile.preferences')}</h3>

          <div className="form-group">
            <label htmlFor="preferredLanguage">{t('profile.language')}</label>
            <select
              id="preferredLanguage"
              name="preferredLanguage"
              value={formData.preferredLanguage}
              onChange={handleInputChange}
            >
              <option value="en">English</option>
              <option value="cs">Čeština</option>
              <option value="de">Deutsch</option>
              <option value="fr">Français</option>
              <option value="es">Español</option>
              <option value="zh">中文</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="themePreference">{t('profile.theme')}</label>
            <select
              id="themePreference"
              name="themePreference"
              value={formData.themePreference}
              onChange={handleInputChange}
            >
              <option value="light">{t('profile.lightTheme')}</option>
              <option value="dark">{t('profile.darkTheme')}</option>
              <option value="system">{t('profile.systemTheme')}</option>
            </select>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="save-button" disabled={isSubmitting}>
            {isSubmitting ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Profile;
