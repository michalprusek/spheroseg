"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, src, alt, ...props }, ref) => {
  const [imgSrc, setImgSrc] = React.useState<string | undefined>(src as string);
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgSrc(src as string);
    setImgError(false);
  }, [src]);

  // If the src contains "minio:9000", replace it with "localhost:9000"
  React.useEffect(() => {
    if (imgSrc && typeof imgSrc === 'string' && imgSrc.includes('minio:9000')) {
      const adjustedSrc = imgSrc.replace(/http:\/\/minio:9000/g, 'http://localhost:9000');
      console.log("AvatarImage: Adjusted src from", imgSrc, "to", adjustedSrc);
      setImgSrc(adjustedSrc);
    }
  }, [imgSrc]);

  const handleError = React.useCallback(() => {
    console.error("AvatarImage: Failed to load image:", imgSrc);
    setImgError(true);
  }, [imgSrc]);

  if (imgError || !imgSrc) {
    return null;
  }

  return (
    <AvatarPrimitive.Image
      ref={ref}
      src={imgSrc}
      alt={alt}
      onError={handleError}
      className={cn("aspect-square h-full w-full", className)}
      {...props}
    />
  );
})
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
