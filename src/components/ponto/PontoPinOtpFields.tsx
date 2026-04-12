import * as React from 'react';
import { OTPInputContext } from 'input-otp';
import { InputOTP, InputOTPGroup } from '@/components/ui/input-otp';
import { cn } from '@/lib/utils';

const PinSlot = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'> & { index: number }
>(({ index, className, ...props }, ref) => {
  const ctx = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = ctx.slots[index];

  return (
    <div
      ref={ref}
      className={cn(
        'relative flex h-12 w-12 items-center justify-center rounded-md border-2 border-input bg-background text-lg font-semibold shadow-sm transition-all',
        isActive && 'z-10 border-primary ring-2 ring-primary ring-offset-2 ring-offset-background',
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink h-4 w-px bg-primary duration-1000" />
        </div>
      )}
    </div>
  );
});
PinSlot.displayName = 'PinSlot';

export type PontoPinOtpFieldsProps = Omit<
  React.ComponentProps<typeof InputOTP>,
  'maxLength' | 'pattern' | 'inputMode' | 'children'
>;

/** Quatro dígitos, estilo OTP (referência intranet), foco com anel azul primário. */
export function PontoPinOtpFields({ className, containerClassName, ...props }: PontoPinOtpFieldsProps) {
  return (
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
  );
}
