import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import apiClient from '@/lib/apiClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

// Define the form schema
const formSchema = z.object({
  title: z
    .string()
    .min(1, { message: 'project.titleRequired' })
    .trim()
    .refine((val) => val.length > 0, { message: 'project.titleRequired' }),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onProjectCreated: (project: { id: string; title: string; description?: string }) => void;
}

const CreateProjectDialog: React.FC<CreateProjectDialogProps> = ({ open, onClose, onProjectCreated }) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  // Initialize the form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
    },
  });

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);

    // Ensure title is not empty after trimming
    const trimmedTitle = data.title.trim();
    if (!trimmedTitle) {
      form.setError('title', {
        type: 'manual',
        message: t('project.titleRequired'),
      });
      setIsLoading(false);
      return;
    }

    try {
      console.log('Creating project with title:', trimmedTitle);

      const response = await apiClient.post('/api/projects', {
        title: trimmedTitle,
        description: data.description,
      });

      console.log('Project created successfully:', response.data);
      onProjectCreated(response.data);
      onClose();
      form.reset();
    } catch (error) {
      console.error('Error creating project:', error);

      // Show error message to user
      if (error.response?.data?.message) {
        form.setError('title', {
          type: 'manual',
          message: error.response.data.message,
        });
      } else {
        form.setError('title', {
          type: 'manual',
          message: t('project.createError'),
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('project.createNew')}</DialogTitle>
          <DialogDescription>{t('project.createDescription')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('project.title')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('project.titlePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('project.description')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t('project.descriptionPlaceholder')} className="resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button variant="outline" type="button" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? t('common.loading') : t('project.create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateProjectDialog;
