import * as React from "react"
import { Input, type InputProps } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Command, CommandList, CommandItem } from "@/components/ui/command"
import { cn } from "@/lib/utils"

export interface AutocompleteOption {
  id: number
  label: string
}

interface AutocompleteInputProps extends Omit<InputProps, "value" | "onChange"> {
  value: string
  onValueChange: (value: string) => void
  options: AutocompleteOption[]
  onSuggestionSelect?: (option: AutocompleteOption) => void
  minChars?: number
}

export function AutocompleteInput({
  value,
  onValueChange,
  options,
  onSuggestionSelect,
  minChars = 3,
  className,
  ...inputProps
}: AutocompleteInputProps) {
  const [open, setOpen] = React.useState(false)

  const filterFor = React.useCallback(
    (v: string) => {
      const query = v.trim().toLowerCase()
      if (query.length < minChars) return []
      return options.filter((o) => o.label.toLowerCase().includes(query)).slice(0, 8)
    },
    [options, minChars],
  )

  const filtered = React.useMemo(() => filterFor(value), [filterFor, value])

  return (
    <Popover open={open} modal={false}>
      <PopoverAnchor asChild>
        <Input
          className={cn("h-8", className)}
          value={value}
          onChange={(e) => {
            onValueChange(e.target.value)
            setOpen(filterFor(e.target.value).length > 0)
          }}
          onFocus={() => setOpen(filtered.length > 0)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false)
          }}
          autoComplete="off"
          {...inputProps}
        />
      </PopoverAnchor>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList onMouseDown={(e) => e.preventDefault()}>
            {filtered.map((opt) => (
              <CommandItem
                key={opt.id}
                value={String(opt.id)}
                onSelect={() => {
                  onValueChange(opt.label)
                  onSuggestionSelect?.(opt)
                  setOpen(false)
                }}
              >
                {opt.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
