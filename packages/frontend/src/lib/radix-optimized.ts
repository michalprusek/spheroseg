/**
 * Optimized Radix UI imports to reduce bundle size
 * Instead of importing entire primitive namespaces, we import only what's needed
 */

// Checkbox optimized imports
export { Root as CheckboxRoot, Indicator as CheckboxIndicator } from '@radix-ui/react-checkbox';

// Dialog optimized imports
export {
  Root as DialogRoot,
  Trigger as DialogTrigger,
  Portal as DialogPortal,
  Overlay as DialogOverlay,
  Content as DialogContent,
  Title as DialogTitle,
  Description as DialogDescription,
  Close as DialogClose,
} from '@radix-ui/react-dialog';

// Dropdown Menu optimized imports
export {
  Root as DropdownMenuRoot,
  Trigger as DropdownMenuTrigger,
  Content as DropdownMenuContent,
  Item as DropdownMenuItem,
  CheckboxItem as DropdownMenuCheckboxItem,
  RadioItem as DropdownMenuRadioItem,
  Label as DropdownMenuLabel,
  Separator as DropdownMenuSeparator,
  Group as DropdownMenuGroup,
  Portal as DropdownMenuPortal,
  Sub as DropdownMenuSub,
  SubContent as DropdownMenuSubContent,
  SubTrigger as DropdownMenuSubTrigger,
  RadioGroup as DropdownMenuRadioGroup,
  ItemIndicator as DropdownMenuItemIndicator,
} from '@radix-ui/react-dropdown-menu';

// Select optimized imports
export {
  Root as SelectRoot,
  Group as SelectGroup,
  Value as SelectValue,
  Trigger as SelectTrigger,
  Content as SelectContent,
  Label as SelectLabel,
  Item as SelectItem,
  Separator as SelectSeparator,
  ScrollUpButton as SelectScrollUpButton,
  ScrollDownButton as SelectScrollDownButton,
  Viewport as SelectViewport,
  Icon as SelectIcon,
  Portal as SelectPortal,
  ItemText as SelectItemText,
  ItemIndicator as SelectItemIndicator,
} from '@radix-ui/react-select';

// Toast optimized imports
export {
  Provider as ToastProvider,
  Root as ToastRoot,
  Action as ToastAction,
  Close as ToastClose,
  Viewport as ToastViewport,
  Title as ToastTitle,
  Description as ToastDescription,
} from '@radix-ui/react-toast';

// Tooltip optimized imports
export {
  Provider as TooltipProvider,
  Root as TooltipRoot,
  Trigger as TooltipTrigger,
  Content as TooltipContent,
  Arrow as TooltipArrow,
  Portal as TooltipPortal,
} from '@radix-ui/react-tooltip';

// Tabs optimized imports
export {
  Root as TabsRoot,
  List as TabsList,
  Trigger as TabsTrigger,
  Content as TabsContent,
} from '@radix-ui/react-tabs';

// Progress optimized imports
export { Root as ProgressRoot, Indicator as ProgressIndicator } from '@radix-ui/react-progress';

// Radio Group optimized imports
export {
  Root as RadioGroupRoot,
  Item as RadioGroupItem,
  Indicator as RadioGroupIndicator,
} from '@radix-ui/react-radio-group';

// Switch optimized imports
export { Root as SwitchRoot, Thumb as SwitchThumb } from '@radix-ui/react-switch';

// Scroll Area optimized imports
export {
  Root as ScrollAreaRoot,
  Viewport as ScrollAreaViewport,
  Scrollbar as ScrollAreaScrollbar,
  Thumb as ScrollAreaThumb,
  Corner as ScrollAreaCorner,
} from '@radix-ui/react-scroll-area';

// Alert Dialog optimized imports
export {
  Root as AlertDialogRoot,
  Trigger as AlertDialogTrigger,
  Portal as AlertDialogPortal,
  Overlay as AlertDialogOverlay,
  Content as AlertDialogContent,
  Title as AlertDialogTitle,
  Description as AlertDialogDescription,
  Action as AlertDialogAction,
  Cancel as AlertDialogCancel,
} from '@radix-ui/react-alert-dialog';

// Label optimized imports
export { Root as Label, Root as LabelRoot } from '@radix-ui/react-label';

// Slot optimized import
export { Slot } from '@radix-ui/react-slot';
