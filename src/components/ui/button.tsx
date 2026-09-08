import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-semibold tracking-wide transition-[opacity,background-color,color,transform] duration-150 ease-out touch-manipulation active:not-disabled:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 select-none [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        play: "bg-fg text-bg hover:bg-fg/90",
        ghost: "bg-fg/20 text-fg hover:bg-fg/30 backdrop-blur-sm",
        accent: "bg-accent text-fg hover:bg-accent-hover",
        outline: "border border-border bg-transparent text-fg hover:bg-elevated",
        muted: "bg-elevated text-fg hover:bg-elevated/80",
      },
      size: {
        sm: "h-11 min-h-11 px-3 text-sm rounded-md",
        md: "h-11 min-h-11 px-5 text-sm rounded-md",
        lg: "h-12 min-h-12 px-7 text-base rounded-lg",
        icon: "size-11 min-h-11 min-w-11 rounded-md",
        "icon-sm": "size-11 min-h-11 min-w-11 rounded-md sm:size-9 sm:min-h-9 sm:min-w-9",
      },
    },
    defaultVariants: { variant: "play", size: "md" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  className,
  variant,
  size,
  type = "button",
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      {...(asChild ? {} : { type })}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
