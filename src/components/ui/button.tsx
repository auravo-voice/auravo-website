import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[color,background-color,box-shadow,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_rgb(30_42_120/0.18),0_0_0_1px_rgb(30_42_120/0.08)] hover:bg-primary-hover hover:shadow-[0_2px_6px_rgb(30_42_120/0.16),0_0_0_1px_rgb(30_42_120/0.1)] active:translate-y-px active:shadow-[0_1px_2px_rgb(30_42_120/0.14)]",
        destructive:
          "bg-destructive text-white shadow-sm hover:bg-destructive/90 active:translate-y-px",
        outline:
          "border border-border bg-card text-foreground shadow-xs hover:border-primary/25 hover:bg-surface-secondary/80",
        secondary:
          "border border-border/80 bg-card text-secondary-foreground shadow-xs hover:bg-surface-secondary",
        ghost: "hover:bg-surface-secondary/80 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        glow:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_rgb(30_42_120/0.18),0_0_0_1px_rgb(30_42_120/0.08)] hover:bg-primary-hover hover:shadow-[0_2px_6px_rgb(30_42_120/0.16)] active:translate-y-px",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-[13px]",
        lg: "h-11 px-5 text-[15px]",
        xl: "h-12 px-6 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
