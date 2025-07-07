import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { X, Plus, Tag, Calendar, User, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  BaseMetadata,
  ImageMetadata,
  DocumentMetadata,
  ProjectMetadata,
  SegmentationMetadata,
} from '@/services/metadataService';
import { useMetadataUpdate } from '@/hooks/useMetadata';
import { format } from 'date-fns';

/**
 * Metadata Editor Component
 * Provides a comprehensive UI for editing metadata
 */

// Base schema for common metadata fields
const BaseMetadataSchema = z.object({
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  custom: z.record(z.any()).optional(),
});

// Type-specific schemas
const ImageMetadataSchema = BaseMetadataSchema.extend({
  scientific: z.object({
    magnification: z.number().positive().optional(),
    pixelSize: z.number().positive().optional(),
    pixelUnit: z.string().optional(),
    channel: z.string().optional(),
    modality: z.string().optional(),
    staining: z.string().optional(),
  }).optional(),
});

const DocumentMetadataSchema = BaseMetadataSchema.extend({
  title: z.string().min(1),
  author: z.string().optional(),
  subject: z.string().optional(),
  language: z.string().optional(),
});

const ProjectMetadataSchema = BaseMetadataSchema.extend({
  title: z.string().min(1),
  status: z.enum(['draft', 'active', 'completed', 'archived']),
  visibility: z.enum(['private', 'public', 'shared']),
  collaborators: z.array(z.string()).optional(),
  completionPercentage: z.number().min(0).max(100).optional(),
});

interface MetadataEditorProps {
  metadata: BaseMetadata;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (metadata: BaseMetadata) => void;
}

export function MetadataEditor({
  metadata,
  open,
  onOpenChange,
  onSave,
}: MetadataEditorProps) {
  const { t } = useTranslation();
  const { update, isUpdating } = useMetadataUpdate();
  const [activeTab, setActiveTab] = useState('general');
  const [newTag, setNewTag] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [customFields, setCustomFields] = useState<Array<{ key: string; value: string }>>([]);

  // Get appropriate schema based on metadata type
  const schema = getSchemaForType(metadata.type);

  // Initialize form with metadata values
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      ...metadata,
      tags: metadata.tags || [],
      keywords: metadata.keywords || [],
      custom: metadata.custom || {},
    },
  });

  // Initialize custom fields from metadata
  useEffect(() => {
    if (metadata.custom) {
      const fields = Object.entries(metadata.custom).map(([key, value]) => ({
        key,
        value: String(value),
      }));
      setCustomFields(fields);
    }
  }, [metadata.custom]);

  // Handle form submission
  const handleSubmit = async (data: any) => {
    try {
      // Convert custom fields array back to object
      const customObject = customFields.reduce((acc, field) => {
        if (field.key && field.value) {
          acc[field.key] = field.value;
        }
        return acc;
      }, {} as Record<string, any>);

      const updates = {
        ...data,
        custom: customObject,
      };

      if (metadata.id) {
        await update({ id: metadata.id, updates });
      }

      onSave?.({ ...metadata, ...updates });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update metadata:', error);
    }
  };

  // Add tag
  const addTag = () => {
    if (newTag.trim()) {
      const currentTags = form.getValues('tags') || [];
      form.setValue('tags', [...currentTags, newTag.trim()]);
      setNewTag('');
    }
  };

  // Remove tag
  const removeTag = (index: number) => {
    const currentTags = form.getValues('tags') || [];
    form.setValue('tags', currentTags.filter((_, i) => i !== index));
  };

  // Add keyword
  const addKeyword = () => {
    if (newKeyword.trim()) {
      const currentKeywords = form.getValues('keywords') || [];
      form.setValue('keywords', [...currentKeywords, newKeyword.trim()]);
      setNewKeyword('');
    }
  };

  // Remove keyword
  const removeKeyword = (index: number) => {
    const currentKeywords = form.getValues('keywords') || [];
    form.setValue('keywords', currentKeywords.filter((_, i) => i !== index));
  };

  // Add custom field
  const addCustomField = () => {
    setCustomFields([...customFields, { key: '', value: '' }]);
  };

  // Update custom field
  const updateCustomField = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customFields];
    updated[index][field] = value;
    setCustomFields(updated);
  };

  // Remove custom field
  const removeCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('metadata.editor.title')}</DialogTitle>
          <DialogDescription>
            {t('metadata.editor.description', { type: t(`metadata.type.${metadata.type}`) })}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">{t('metadata.editor.tabs.general')}</TabsTrigger>
                <TabsTrigger value="specific">{t('metadata.editor.tabs.specific')}</TabsTrigger>
                <TabsTrigger value="custom">{t('metadata.editor.tabs.custom')}</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('metadata.fields.description')}</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder={t('metadata.editor.placeholders.description')}
                          rows={3}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('metadata.editor.hints.description')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <div className="space-y-4">
                  <div>
                    <Label>{t('metadata.fields.tags')}</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder={t('metadata.editor.placeholders.tag')}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      />
                      <Button type="button" onClick={addTag} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(form.watch('tags') || []).map((tag, index) => (
                        <Badge key={index} variant="secondary">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(index)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>{t('metadata.fields.keywords')}</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        placeholder={t('metadata.editor.placeholders.keyword')}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                      />
                      <Button type="button" onClick={addKeyword} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(form.watch('keywords') || []).map((keyword, index) => (
                        <Badge key={index} variant="outline">
                          {keyword}
                          <button
                            type="button"
                            onClick={() => removeKeyword(index)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="specific" className="space-y-4 mt-4">
                {renderTypeSpecificFields(metadata.type, form, t)}
              </TabsContent>

              <TabsContent value="custom" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>{t('metadata.editor.customFields')}</Label>
                    <Button type="button" onClick={addCustomField} size="sm" variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      {t('metadata.editor.addField')}
                    </Button>
                  </div>

                  {customFields.map((field, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={field.key}
                        onChange={(e) => updateCustomField(index, 'key', e.target.value)}
                        placeholder={t('metadata.editor.placeholders.fieldName')}
                      />
                      <Input
                        value={field.value}
                        onChange={(e) => updateCustomField(index, 'value', e.target.value)}
                        placeholder={t('metadata.editor.placeholders.fieldValue')}
                      />
                      <Button
                        type="button"
                        onClick={() => removeCustomField(index)}
                        size="icon"
                        variant="ghost"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {customFields.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t('metadata.editor.noCustomFields')}
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isUpdating}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? t('common.saving') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Get schema for metadata type
function getSchemaForType(type: string) {
  switch (type) {
    case 'image':
      return ImageMetadataSchema;
    case 'document':
      return DocumentMetadataSchema;
    case 'project':
      return ProjectMetadataSchema;
    default:
      return BaseMetadataSchema;
  }
}

// Render type-specific fields
function renderTypeSpecificFields(type: string, form: any, t: any) {
  switch (type) {
    case 'image':
      return <ImageSpecificFields form={form} t={t} />;
    case 'document':
      return <DocumentSpecificFields form={form} t={t} />;
    case 'project':
      return <ProjectSpecificFields form={form} t={t} />;
    default:
      return (
        <p className="text-sm text-muted-foreground text-center py-8">
          {t('metadata.editor.noSpecificFields')}
        </p>
      );
  }
}

// Image-specific fields
function ImageSpecificFields({ form, t }: { form: any; t: any }) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium">{t('metadata.image.scientific')}</h4>
      
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="scientific.magnification"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('metadata.image.scientific.magnification')}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="scientific.pixelSize"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('metadata.image.scientific.pixelSize')}</FormLabel>
              <FormControl>
                <div className="flex gap-2">
                  <Input
                    {...field}
                    type="number"
                    step="0.01"
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  />
                  <Controller
                    control={form.control}
                    name="scientific.pixelUnit"
                    render={({ field: unitField }) => (
                      <Select value={unitField.value} onValueChange={unitField.onChange}>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nm">nm</SelectItem>
                          <SelectItem value="μm">μm</SelectItem>
                          <SelectItem value="mm">mm</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="scientific.modality"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('metadata.image.scientific.modality')}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="scientific.staining"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('metadata.image.scientific.staining')}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

// Document-specific fields
function DocumentSpecificFields({ form, t }: { form: any; t: any }) {
  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('metadata.document.title')}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="author"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('metadata.document.author')}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="subject"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('metadata.document.subject')}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="language"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('metadata.document.language')}</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="cs">Čeština</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="it">Italiano</SelectItem>
                <SelectItem value="ja">日本語</SelectItem>
                <SelectItem value="ko">한국어</SelectItem>
                <SelectItem value="pt">Português</SelectItem>
                <SelectItem value="ru">Русский</SelectItem>
                <SelectItem value="zh">中文</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

// Project-specific fields
function ProjectSpecificFields({ form, t }: { form: any; t: any }) {
  const [newCollaborator, setNewCollaborator] = useState('');

  const addCollaborator = () => {
    if (newCollaborator.trim()) {
      const current = form.getValues('collaborators') || [];
      form.setValue('collaborators', [...current, newCollaborator.trim()]);
      setNewCollaborator('');
    }
  };

  const removeCollaborator = (index: number) => {
    const current = form.getValues('collaborators') || [];
    form.setValue('collaborators', current.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('metadata.project.title')}</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('metadata.project.status')}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="draft">{t('metadata.project.status.draft')}</SelectItem>
                  <SelectItem value="active">{t('metadata.project.status.active')}</SelectItem>
                  <SelectItem value="completed">{t('metadata.project.status.completed')}</SelectItem>
                  <SelectItem value="archived">{t('metadata.project.status.archived')}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="visibility"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('metadata.project.visibility')}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="private">{t('metadata.project.visibility.private')}</SelectItem>
                  <SelectItem value="public">{t('metadata.project.visibility.public')}</SelectItem>
                  <SelectItem value="shared">{t('metadata.project.visibility.shared')}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="completionPercentage"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('metadata.project.completion')}</FormLabel>
            <FormControl>
              <div className="flex items-center gap-4">
                <Input
                  {...field}
                  type="number"
                  min="0"
                  max="100"
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div>
        <Label>{t('metadata.project.collaborators')}</Label>
        <div className="flex gap-2 mt-2">
          <Input
            value={newCollaborator}
            onChange={(e) => setNewCollaborator(e.target.value)}
            placeholder={t('metadata.editor.placeholders.collaborator')}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCollaborator())}
          />
          <Button type="button" onClick={addCollaborator} size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {(form.watch('collaborators') || []).map((collaborator: string, index: number) => (
            <Badge key={index} variant="outline">
              <User className="mr-1 h-3 w-3" />
              {collaborator}
              <button
                type="button"
                onClick={() => removeCollaborator(index)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}