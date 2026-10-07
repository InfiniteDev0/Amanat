import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"

// Sarrif: filled, no border; a touch lighter on focus. No rings or shadows.
// Autofill keeps our colours (Chrome would paint the field blue).
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-xl bg-field px-4 py-1 text-sm text-foreground transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:bg-field-focus disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 autofill:[-webkit-text-fill-color:var(--foreground)] autofill:[transition:background-color_9999s_ease-in-out_0s]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
