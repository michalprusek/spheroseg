import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, Share2, UserPlus, X, Eye, Edit, Trash } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import apiClient from '@/lib/apiClient';

interface ShareDialogProps {
  projectId: string;
  projectName: string;
  isOwner: boolean;
}

// Schema pro validaci formuláře pro sdílení
const shareFormSchema = z.object({
  email: z.string().email({ message: 'Neplatná e-mailová adresa' }),
  permission: z.enum(['view', 'edit'], {
    required_error: 'Vyberte typ oprávnění',
  }),
});

type ShareFormValues = z.infer<typeof shareFormSchema>;

// Typ pro sdílené uživatele
interface SharedUser {
  id: string;
  email: string;
  permission: 'view' | 'edit';
  userName?: string;
  isPending: boolean;
}

const ShareDialog: React.FC<ShareDialogProps> = ({ projectId, projectName, isOwner }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const [isLoadingShares, setIsLoadingShares] = useState(false);

  // Inicializace React Hook Form
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
      setSharedUsers(response.data.data);
    } catch (error) {
      console.error('Error fetching shared users:', error);
      toast.error('Nepodařilo se načíst sdílené uživatele');
    } finally {
      setIsLoadingShares(false);
    }
  };

  // Funkce pro zpracování formuláře
  const onSubmit = async (values: ShareFormValues) => {
    setIsLoading(true);
    try {
      await apiClient.post(`/api/project-shares/${projectId}`, values);
      toast.success(`Projekt "${projectName}" byl sdílen s ${values.email}`);
      form.reset();
      fetchSharedUsers(); // Po úspěšném sdílení znovu načteme seznam sdílených uživatelů
    } catch (error: any) {
      console.error('Error sharing project:', error);

      // Zpracování různých typů chyb
      if (error.response?.status === 409) {
        toast.error('Projekt je již sdílen s tímto uživatelem');
      } else if (error.response?.status === 400) {
        toast.error('Neplatný email nebo oprávnění');
      } else if (error.response?.status === 404) {
        toast.error('Projekt nebyl nalezen');
      } else {
        toast.error('Nepodařilo se sdílet projekt');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Funkce pro odebrání sdílení
  const handleRemoveShare = async (shareId: string, email: string) => {
    try {
      await apiClient.delete(`/api/project-shares/${projectId}/${shareId}`);
      toast.success(`Sdílení s ${email} bylo odebráno`);
      fetchSharedUsers(); // Po úspěšném odebrání znovu načteme seznam sdílených uživatelů
    } catch (error) {
      console.error('Error removing share:', error);
      toast.error('Nepodařilo se odebrat sdílení');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          onClick={(e) => {
            e.stopPropagation(); // Zabránění propagace kliknutí na kartu
            setIsOpen(true);
          }}
          title="Sdílet projekt"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sdílet projekt "{projectName}"</DialogTitle>
          <DialogDescription>Pozvěte ostatní uživatele ke spolupráci na tomto projektu.</DialogDescription>
        </DialogHeader>

        {isOwner ? (
          <div className="space-y-4">
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
                            <Input placeholder="Email uživatele" className="pl-8" {...field} disabled={isLoading} />
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
                        Sdílení...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Pozvat
                      </>
                    )}
                  </Button>
                </div>

                <FormField
                  control={form.control}
                  name="permission"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Oprávnění</FormLabel>
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
                            Pouze zobrazení
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="edit" />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">
                            <Edit className="h-4 w-4 inline mr-1" />
                            Úpravy
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                      <FormDescription>Vyberte úroveň přístupu pro tohoto uživatele</FormDescription>
                    </FormItem>
                  )}
                />
              </form>
            </Form>

            <Separator />

            <div>
              <h3 className="text-sm font-medium mb-2">Sdíleno s</h3>

              {isLoadingShares ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : sharedUsers.length > 0 ? (
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Oprávnění</TableHead>
                        <TableHead>Status</TableHead>
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
                                Zobrazení
                              </span>
                            ) : (
                              <span className="flex items-center">
                                <Edit className="h-3 w-3 mr-1" />
                                Úpravy
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.isPending ? (
                              <span className="text-amber-500 text-xs">Čeká na přijetí</span>
                            ) : (
                              <span className="text-green-500 text-xs">Přijato</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveShare(user.id, user.email)}
                              title="Odebrat sdílení"
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
                  Tento projekt zatím není sdílen s nikým
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-center py-4">Nemáte oprávnění ke sdílení tohoto projektu.</p>
        )}

        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
            <X className="mr-2 h-4 w-4" />
            Zavřít
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;
