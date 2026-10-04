"use client";

// The existing Sheet is built on Radix Dialog: reuse its focus trap and keyboard behavior.
import { SheetContent } from "./sheet";
export {
  Sheet as Drawer,
  SheetTrigger as DrawerTrigger,
  SheetClose as DrawerClose,
  SheetHeader as DrawerHeader,
  SheetTitle as DrawerTitle,
  SheetDescription as DrawerDescription,
  SheetFooter as DrawerFooter,
} from "./sheet";
export function DrawerContent(
  props: React.ComponentProps<typeof SheetContent>,
) {
  return <SheetContent side="bottom" {...props} />;
}
