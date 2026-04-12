import type { ComponentProps } from "react";
import { useState } from "react";
import { useTheme } from "next-themes";
import { createPortal } from "react-dom";
import { Toaster as Sonner, toast } from "sonner";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { cn } from "@/lib/utils";

type ToasterProps = ComponentProps<typeof Sonner>;

const MOBILE_TOAST_MS = 9000;
const DESKTOP_TOAST_MS = 4000;

const Toaster = ({
  className,
  position,
  offset,
  mobileOffset,
  toastOptions: toastOptionsProp,
  duration: durationProp,
  ...rest
}: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const isMobile = useIsMobileViewport();
  const [body] = useState<HTMLElement | null>(() =>
    typeof document !== "undefined" ? document.body : null,
  );

  const duration = durationProp ?? (isMobile ? MOBILE_TOAST_MS : DESKTOP_TOAST_MS);

  const node = (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className={cn(
        "toaster group !z-[10000050]",
        className,
      )}
      position={isMobile ? "top-center" : position ?? "bottom-right"}
      offset={
        isMobile ? { top: "max(12px, env(safe-area-inset-top, 0px))" } : offset
      }
      mobileOffset={
        isMobile
          ? { top: "max(12px, env(safe-area-inset-top, 0px))" }
          : mobileOffset
      }
      richColors
      closeButton={isMobile}
      duration={duration}
      visibleToasts={3}
      toastOptions={{
        ...toastOptionsProp,
        duration,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          ...toastOptionsProp?.classNames,
        },
      }}
      {...rest}
    />
  );

  if (typeof document === "undefined" || !body) {
    return null;
  }

  return createPortal(node, body);
};

export { Toaster, toast };
