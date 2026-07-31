import * as React from "react"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Command, CommandList, CommandItem } from "@/components/ui/command"
import { cn } from "@/lib/utils"

export interface TagOption {
  id: number
  label: string
}

interface TagInputProps {
  value: string[]
  onValueChange: (tags: string[]) => void
  options: TagOption[]
  placeholder?: string
  className?: string
}

export function TagInput({ value, onValueChange, options, placeholder, className }: TagInputProps) {
  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)

  const filtered = React.useMemo(() => {
    const available = options.filter((o) => !value.includes(o.label))
    const q = query.trim().toLowerCase()
    if (!q) return available.slice(0, 8)
    return available.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 8)
  }, [query, options, value])

  function addTag(label: string) {
    const trimmed = label.trim()
    if (!trimmed || value.includes(trimmed)) {
      setQuery("")
      return
    }
    onValueChange([...value, trimmed])
    setQuery("")
    setOpen(false)
  }

  function removeTag(label: string) {
    onValueChange(value.filter((t) => t !== label))
  }

  return (
    <Popover open={open && filtered.length > 0} modal={false}>
      <PopoverAnchor asChild>
        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 min-h-9 focus-within:ring-1 focus-within:ring-ring",
            className,
          )}
        >
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 font-normal">
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          <input
            className="flex-1 min-w-[140px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            value={query}
            placeholder={value.length === 0 ? placeholder : ""}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim()) {
                e.preventDefault()
                addTag(query)
              } else if (e.key === "Backspace" && !query && value.length > 0) {
                removeTag(value[value.length - 1]!)
              } else if (e.key === "Escape") {
                setOpen(false)
              }
            }}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList onMouseDown={(e) => e.preventDefault()}>
            {filtered.map((opt) => (
              <CommandItem key={opt.id} value={String(opt.id)} onSelect={() => addTag(opt.label)}>
                {opt.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
