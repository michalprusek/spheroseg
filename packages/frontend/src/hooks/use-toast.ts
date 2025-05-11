import { toast as sonnerToast } from 'sonner';

// Directly export the toast function from sonner
export const toast = sonnerToast;

// Remove the hook structure as it's no longer needed for simple toast calls
// export const useToast = () => {
//   const [toasts, setToasts] = useState<Toast[]>([]);
//
//   // Vracíme pouze funkci toast, ale zachováváme kompatibilitu s Toaster komponentou
//   return {
//     toast,
//     toasts
//   };
// };

// Remove unused types if they were specific to the old hook structure
// type ToastProps = { ... };
// type Toast = { ... };
