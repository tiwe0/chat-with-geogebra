import * as React from "react"
import { X } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toastVariants = cva(
  "fixed flex items-center justify-between w-full max-w-sm p-4 rounded-lg shadow-lg transition-all duration-300 ease-in-out",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        success: "bg-green-100 text-green-800",
        error: "bg-red-100 text-red-800",
        warning: "bg-yellow-100 text-yellow-800",
        info: "bg-blue-100 text-blue-800",
      },
      position: {
        topRight: "top-4 right-4",
        topLeft: "top-4 left-4",
        bottomRight: "bottom-4 right-4",
        bottomLeft: "bottom-4 left-4",
        top: "top-4 left-1/2 -translate-x-1/2",
        bottom: "bottom-4 left-1/2 -translate-x-1/2",
      },
    },
    defaultVariants: {
      variant: "default",
      position: "top",
    },
  },
)

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof toastVariants> {
  open?: boolean
  onClose?: () => void
  autoClose?: boolean
  autoCloseDelay?: number
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  (
    {
      className,
      variant,
      position,
      open = false,
      onClose,
      autoClose = true,
      autoCloseDelay = 3000,
      children,
      ...props
    },
    ref,
  ) => {
    const [isVisible, setIsVisible] = React.useState(open)

    React.useEffect(() => {
      setIsVisible(open)
    }, [open])

    React.useEffect(() => {
      if (isVisible && autoClose) {
        const timer = setTimeout(() => {
          setIsVisible(false)
          if (onClose) onClose()
        }, autoCloseDelay)
        return () => clearTimeout(timer)
      }
    }, [isVisible, autoClose, autoCloseDelay, onClose])

    if (!isVisible) return null

    return (
      <div ref={ref} className={cn(toastVariants({ variant, position }), "z-50", className)} {...props}>
        <div className="flex-1">{children}</div>
        {onClose && (
          <button
            onClick={() => {
              setIsVisible(false)
              onClose()
            }}
            className="ml-4 p-1 rounded-full hover:bg-black/10"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  },
)
Toast.displayName = "Toast"

export { Toast, toastVariants }

