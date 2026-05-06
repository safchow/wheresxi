import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface DropdownProps {
  trigger: React.ReactNode
  children: React.ReactNode | ((close: () => void) => React.ReactNode)
  align?: 'start' | 'end'
  className?: string
  contentClassName?: string
}

/**
 * Minimal click-outside-to-close dropdown. We don't pull in Radix here to
 * keep bundle size sane — this covers our one usage (wallet menu).
 */
export function Dropdown({
  trigger,
  children,
  align = 'end',
  className,
  contentClassName,
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(e: PointerEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="appearance-none bg-transparent p-0 text-left"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute top-full z-40 mt-2 min-w-[14rem] rounded-md border border-border bg-card p-1 shadow-lg',
            align === 'end' ? 'right-0' : 'left-0',
            contentClassName,
          )}
        >
          {typeof children === 'function'
            ? children(() => setOpen(false))
            : children}
        </div>
      )}
    </div>
  )
}

interface DropdownItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  destructive?: boolean
}

export function DropdownItem({
  className,
  destructive,
  children,
  ...props
}: DropdownItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm transition',
        'enabled:hover:bg-accent enabled:hover:text-accent-foreground',
        'disabled:cursor-not-allowed disabled:opacity-50',
        destructive && 'enabled:text-no enabled:hover:bg-no/10',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function DropdownSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />
}

export function DropdownLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'px-2.5 pb-1 pt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  )
}
