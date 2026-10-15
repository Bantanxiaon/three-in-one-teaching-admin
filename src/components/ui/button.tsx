import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "group relative inline-flex h-[52px] items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full px-7 text-sm font-medium transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 before:absolute before:inset-0 before:-translate-x-full before:bg-[linear-gradient(115deg,transparent,rgba(255,255,255,0.55),transparent)] before:transition-transform before:duration-700 hover:scale-[1.025] hover:before:translate-x-full",
  {
    variants: {
      variant: {
        default: "border border-white/20 bg-piano/90 text-white shadow-[0_14px_42px_rgba(5,5,5,0.16)] backdrop-blur-[20px] hover:shadow-[0_18px_54px_rgba(5,5,5,0.20)]",
        light: "border border-white/30 bg-white/60 text-piano shadow-[0_12px_34px_rgba(5,5,5,0.08)] backdrop-blur-[20px] hover:bg-white/75",
        outline: "border border-white/30 bg-white/35 text-piano shadow-[0_12px_34px_rgba(5,5,5,0.07)] backdrop-blur-[20px] hover:bg-white/60",
        ghost: "bg-transparent text-piano hover:bg-white/45",
        gold: "border border-white/25 bg-gold/90 text-white shadow-[0_14px_42px_rgba(184,155,94,0.24)] backdrop-blur-[20px] hover:bg-gold"
      },
      size: {
        default: "h-[52px] px-7",
        sm: "h-10 px-4",
        lg: "h-14 px-9",
        icon: "h-12 w-12 px-0"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
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
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
