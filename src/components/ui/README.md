# ui

## Purpose

shadcn/ui (new-york style) primitives — Radix-backed, CLI-managed; per this
repo's AGENTS.md these should not be hand-edited outside the shadcn CLI.

## Contents

- `alert-dialog.tsx` — Radix `AlertDialog` wrapper (Root/Trigger/Portal/Overlay/Content/Header/Footer/Title/Description/Action/Cancel); confirmation-style modals that block until the vendor picks an action
- `badge.tsx` — `Badge`/`badgeVariants` (cva variants: default/secondary/destructive/outline/ghost/link), `asChild`-capable via Radix `Slot`; used by the admin console's Free/Pro plan badges
- `button.tsx` — `Button`/`buttonVariants` (cva variants/sizes), `asChild`-capable via Radix `Slot`
- `card.tsx` — plain-div `Card` composition: `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardAction`/`CardContent`/`CardFooter`
- `command.tsx` — `cmdk`-backed `Command`/`CommandDialog`/`CommandInput`/`CommandList`/`CommandEmpty`/`CommandGroup`/`CommandItem`/`CommandSeparator`/`CommandShortcut`; paired with `popover.tsx` to build the products form's unit combobox (`product-form.tsx`)
- `dialog.tsx` — Radix `Dialog` wrapper: `Dialog`/`DialogClose`/`DialogContent`/`DialogDescription`/`DialogFooter`/`DialogHeader`/`DialogOverlay`/`DialogPortal`/`DialogTitle`/`DialogTrigger`
- `input.tsx` — `Input`: styled native `<input>` with focus-ring and `aria-invalid` styling
- `label.tsx` — `Label`: Radix `Label` wrapper, disabled-peer/group styling
- `popover.tsx` — Radix `Popover` wrapper: `Popover`/`PopoverTrigger`/`PopoverContent`/`PopoverAnchor`/`PopoverHeader`/`PopoverTitle`/`PopoverDescription`
- `select.tsx` — Radix `Select` wrapper: `Select`/`SelectGroup`/`SelectValue`/`SelectTrigger`/`SelectContent`/`SelectLabel`/`SelectItem`/`SelectSeparator`/`SelectScrollUpButton`/`SelectScrollDownButton`
- `separator.tsx` — Radix `Separator` wrapper: horizontal/vertical divider line
- `switch.tsx` — Radix `Switch` wrapper
- `tabs.tsx` — Radix `Tabs` wrapper
- `textarea.tsx` — `Textarea`: styled native `<textarea>` with focus-ring and `aria-invalid` styling

## Parent

[components](../README.md)
