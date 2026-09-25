import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

/**
 * A popover opened from inside a Dialog renders in a portal outside the dialog, and the
 * dialog's scroll lock (react-remove-scroll) then swallows wheel events over it — lists in
 * the popover (e.g. column filters in the exercise picker) can't be scrolled with the mouse
 * wheel. While a scroll lock is active, scroll the nearest scrollable element under the
 * pointer ourselves. Without a lock, native scrolling is left alone.
 */
function useWheelScrollInsideScrollLock(contentRef: React.RefObject<HTMLDivElement>) {
  React.useEffect(() => {
    const root = contentRef.current
    if (!root) return
    const onWheel = (e: WheelEvent) => {
      // Already handled (e.g. CommandList does its own) or no dialog scroll lock active
      if (e.defaultPrevented || !document.body.hasAttribute("data-scroll-locked")) return
      let el = e.target as HTMLElement | null
      while (el && root.contains(el)) {
        const { overflowY } = getComputedStyle(el)
        if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) break
        el = el.parentElement
      }
      if (!el || !root.contains(el)) return
      e.preventDefault()
      // deltaMode: 0 = pixels, 1 = lines (Firefox), 2 = pages
      const factor = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1
      el.scrollTop += e.deltaY * factor
    }
    root.addEventListener("wheel", onWheel, { passive: false })
    return () => root.removeEventListener("wheel", onWheel)
  })
}

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => {
  const innerRef = React.useRef<HTMLDivElement>(null)
  useWheelScrollInsideScrollLock(innerRef)
  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      (innerRef as React.MutableRefObject<HTMLDivElement | null>).current = node
      if (typeof ref === "function") ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
    },
    [ref]
  )
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={setRefs}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
})
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
