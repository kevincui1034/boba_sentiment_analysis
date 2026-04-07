import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function Pagination({
  className,
  ...props
}: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  )
}

export function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul className={cn("flex flex-row items-center gap-1", className)} {...props} />
  )
}

export function PaginationItem(props: React.ComponentProps<"li">) {
  return <li {...props} />
}

export function PaginationLink({
  isActive,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { isActive?: boolean }) {
  return (
    <Button
      aria-current={isActive ? "page" : undefined}
      variant={isActive ? "default" : "outline"}
      size="sm"
      className={cn("h-8 min-w-8", className)}
      {...props}
    />
  )
}

export function PaginationPrevious(props: React.ComponentProps<typeof PaginationLink>) {
  return <PaginationLink aria-label="Go to previous page" {...props}>Previous</PaginationLink>
}

export function PaginationNext(props: React.ComponentProps<typeof PaginationLink>) {
  return <PaginationLink aria-label="Go to next page" {...props}>Next</PaginationLink>
}
