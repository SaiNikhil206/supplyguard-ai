import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@/lib/utils';

export const Avatar = forwardRef<ElementRef<typeof AvatarPrimitive.Root>, ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>>(
  function Avatar({ className, ...props }, ref) {
    return <AvatarPrimitive.Root ref={ref} className={cn('relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full', className)} {...props} />;
  },
);

export const AvatarImage = forwardRef<
  ElementRef<typeof AvatarPrimitive.Image>,
  ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(function AvatarImage({ className, ...props }, ref) {
  return <AvatarPrimitive.Image ref={ref} className={cn('aspect-square h-full w-full', className)} {...props} />;
});

export const AvatarFallback = forwardRef<
  ElementRef<typeof AvatarPrimitive.Fallback>,
  ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(function AvatarFallback({ className, ...props }, ref) {
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn('flex h-full w-full items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground', className)}
      {...props}
    />
  );
});
