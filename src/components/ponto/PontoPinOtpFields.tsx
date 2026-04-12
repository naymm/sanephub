import * as React from 'react';
import { OTPInputContext } from 'input-otp';
import { InputOTP, InputOTPGroup } from '@/components/ui/input-otp';
import { cn } from '@/lib/utils';

const OtpFieldsVariantContext = React.createContext<'default' | 'dark'>('default');

const PinSlot = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'> & { index: number }
>(({ index, className, ...props }, ref) => {
  const variant = React.useContext(OtpFieldsVariantContext);
  const ctx = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = ctx.slots[index];
  const isDark = variant === 'dark';

  return (
    <div
      ref={ref}
      className={cn(
        'relative flex items-center justify-center font-semibold transition-all',
        isDark
          ? 'h-14 w-14 rounded-xl border border-white/20 bg-black/35 text-xl text-white shadow-none'
          : 'h-12 w-12 rounded-md border-2 border-input bg-background text-lg shadow-sm',
        !isDark && isActive && 'z-10 border-primary ring-2 ring-primary ring-offset-2 ring-offset-background',
        isDark &&
          isActive &&
          'z-10 border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary))]/40 ring-offset-2 ring-offset-transparent',
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              'animate-caret-blink h-4 w-px duration-1000',
              isDark ? 'bg-[hsl(var(--primary))]' : 'bg-primary',
            )}
          />
        </div>
      )}
    </div>
  );
});
PinSlot.displayName = 'PinSlot';

export type PontoPinOtpFieldsProps = Omit<
  React.ComponentProps<typeof InputOTP>,
  'maxLength' | 'pattern' | 'inputMode' | 'children'
> & {
  variant?: 'default' | 'dark';
};

/** Quatro dígitos, estilo OTP (referência intranet), foco com anel azul primário. */
export function PontoPinOtpFields({
  className,
  containerClassName,
  variant = 'default',
  ...props
}: PontoPinOtpFieldsProps) {
  return (
    <OtpFieldsVariantContext.Provider value={variant}>
      <InputOTP
        maxLength={4}
        pattern="^[0-9]*$"
        inputMode="numeric"
        className={className}
        containerClassName={cn('justify-center', containerClassName)}
        {...props}
      >
        <InputOTPGroup className="gap-2 sm:gap-3">
          <PinSlot index={0} />
          <PinSlot index={1} />
          <PinSlot index={2} />
          <PinSlot index={3} />
        </InputOTPGroup>
      </InputOTP>
    </OtpFieldsVariantContext.Provider>
  );
}
