import React, { forwardRef } from 'react';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'default',
      size = 'default',
      asChild = false,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none';

    const variants: Record<string, string> = {
      default: 'bg-slate-900 text-white shadow hover:bg-slate-800',
      destructive: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
      outline:
        'border border-slate-200 bg-white shadow-xs hover:bg-slate-100 hover:text-slate-900',
      secondary: 'bg-slate-100 text-slate-900 shadow-xs hover:bg-slate-200',
      ghost: 'hover:bg-slate-100 hover:text-slate-900',
      link: 'text-blue-600 underline-offset-4 hover:underline',
    };

    const sizes: Record<string, string> = {
      default: 'h-9 px-4 py-2',
      sm: 'h-8 rounded-md px-3 text-xs',
      lg: 'h-10 rounded-xl px-8',
      icon: 'h-9 w-9',
    };

    const computedClass = `${baseStyles} ${variants[variant] || variants.default} ${
      sizes[size] || sizes.default
    } ${className}`.trim();

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        className: `${computedClass} ${(children as React.ReactElement<any>).props.className || ''}`.trim(),
        ref,
        ...props,
      });
    }

    return (
      <button ref={ref} className={computedClass} {...props}>
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
