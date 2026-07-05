"use client"

import { format, parse, isValid } from "date-fns"
import { fr } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// value / onChange en ISO yyyy-MM-dd (contrat API inchangé).
export function DatePicker({
  value,
  onChange,
  placeholder = "Choisir une date",
  id,
}: {
  value: string
  onChange: (iso: string) => void
  placeholder?: string
  id?: string
}) {
  const parsed = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined
  const selected = parsed && isValid(parsed) ? parsed : undefined
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn("w-full justify-start text-left font-normal", !selected && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, "dd MMM yyyy", { locale: fr }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={fr}
          selected={selected}
          onSelect={(d) => { if (d) onChange(format(d, "yyyy-MM-dd")) }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
