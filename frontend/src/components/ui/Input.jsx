import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const Input = React.forwardRef(
  (
    {
      className,
      type = "text",
      label,
      error,
      icon: Icon,
      id,
      ...props
    },
    ref
  ) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={id}
            className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {Icon && (
            <div className="absolute left-4 text-slate-400 pointer-events-none select-none">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <input
            id={id}
            ref={ref}
            type={type}
            className={twMerge(
              clsx(
                "w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-slate-900 transition-all placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:border-primary-500",
                {
                  "pl-12": Icon,
                  "border-red-500 focus:border-red-500 focus:ring-red-500/10 dark:border-red-500/80": error,
                }
              ),
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs font-medium text-red-500 animate-slide-in select-none">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
