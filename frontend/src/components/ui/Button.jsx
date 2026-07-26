import React from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const Button = React.forwardRef(
  (
    {
      className,
      variant = "primary",
      size = "default",
      isLoading = false,
      disabled = false,
      children,
      type = "button",
      ...props
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
        className={twMerge(
          clsx(
            "inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98]",
            {
              "bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-primary-500/10 active:bg-primary-800":
                variant === "primary",
              "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 dark:hover:bg-slate-800/80":
                variant === "secondary",
              "bg-transparent text-slate-600 hover:bg-slate-100/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-100":
                variant === "ghost",
            },
            {
              "h-12 px-6 text-base": size === "default",
              "h-10 px-4 text-sm": size === "sm",
              "h-14 px-8 text-lg": size === "lg",
            },
            className
          )
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : null}
        {children}
      </motion.button>
    );
  }
);

Button.displayName = "Button";

export default Button;
