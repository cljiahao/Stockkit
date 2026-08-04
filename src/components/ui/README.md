# ui

## Purpose

shadcn/ui (new-york style) primitives — Radix-backed, CLI-managed; per this
repo's AGENTS.md these should not be hand-edited outside the shadcn CLI.

## Contents

- `alert-dialog.tsx` — Radix `AlertDialog` wrapper (Root/Trigger/Portal/Overlay/Content/Header/Footer/Title/Description/Action/Cancel); confirmation-style modals that block until the vendor picks an action
- `avatar.tsx` — Radix `Avatar` wrapper: `Avatar`/`AvatarImage`/`AvatarFallback` plus `AvatarBadge`/`AvatarGroup`/`AvatarGroupCount` for stacked-avatar UI
- `badge.tsx` — `Badge`/`badgeVariants` (cva variants: default/secondary/destructive/outline/ghost/link), `asChild`-capable via Radix `Slot`; used by the admin console's Free/Pro plan badges
- `button.tsx` — `Button`/`buttonVariants` (cva variants/sizes), `asChild`-capable via Radix `Slot`
- `card.tsx` — plain-div `Card` composition: `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardAction`/`CardContent`/`CardFooter`
- `checkbox.tsx` — `Checkbox`: Radix `Checkbox` wrapper with the app's focus-ring/`aria-invalid` styling
- `dialog.tsx` — Radix `Dialog` wrapper: `Dialog`/`DialogClose`/`DialogContent`/`DialogDescription`/`DialogFooter`/`DialogHeader`/`DialogOverlay`/`DialogPortal`/`DialogTitle`/`DialogTrigger`
- `dropdown-menu.tsx` — Radix `DropdownMenu` wrapper: full primitive set (Trigger/Content/Group/Item/CheckboxItem/RadioGroup/RadioItem/Label/Separator/Shortcut/Sub/SubTrigger/SubContent)
- `field.tsx` — form-layout primitives (`Field`/`FieldContent`/`FieldDescription`/`FieldError`/`FieldGroup`/`FieldLabel`/`FieldLegend`/`FieldSeparator`/`FieldSet`/`FieldTitle`) used to lay out labeled inputs with consistent spacing and error text, independent of `form.tsx`'s React Hook Form binding
- `form.tsx` — React Hook Form integration layer (`Form`/`FormControl`/`FormDescription`/`FormField`/`FormItem`/`FormLabel`/`FormMessage`/`useFormField`); binds RHF field state to `field.tsx`'s layout primitives
- `input.tsx` — `Input`: styled native `<input>` with focus-ring and `aria-invalid` styling
- `label.tsx` — `Label`: Radix `Label` wrapper, disabled-peer/group styling
- `select.tsx` — Radix `Select` wrapper: `Select`/`SelectGroup`/`SelectValue`/`SelectTrigger`/`SelectContent`/`SelectLabel`/`SelectItem`/`SelectSeparator`/`SelectScrollUpButton`/`SelectScrollDownButton`
- `separator.tsx` — Radix `Separator` wrapper: horizontal/vertical divider line
- `sheet.tsx` — Radix `Dialog`-backed slide-in panel: `Sheet`/`SheetTrigger`/`SheetClose`/`SheetPortal`/`SheetOverlay`/`SheetContent` (side `top`/`right`/`bottom`/`left`)/`SheetHeader`/`SheetFooter`/`SheetTitle`/`SheetDescription`
- `sonner.tsx` — `Toaster`: theme-aware wrapper around the `sonner` toast library, mounted once near the app root
- `switch.tsx` — Radix `Switch` wrapper
- `tabs.tsx` — Radix `Tabs` wrapper
- `textarea.tsx` — `Textarea`: styled native `<textarea>` with focus-ring and `aria-invalid` styling
- `toggle-group.tsx` — `ToggleGroup`/`ToggleGroupItem`: Radix `ToggleGroup` wrapper for exclusive/multiple button-group selection (e.g. feedback/support category pickers)
- `toggle.tsx` — `Toggle`/`toggleVariants`: Radix `Toggle` wrapper, cva variants

## Parent

[components](../README.md)
