import * as React from "react"
import { cn } from "@/lib/utils"

const FieldGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("grid gap-6", className)} {...props} />
  )
)
FieldGroup.displayName = "FieldGroup"

const FieldSet = React.forwardRef<HTMLFieldSetElement, React.FieldsetHTMLAttributes<HTMLFieldSetElement>>(
  ({ className, ...props }, ref) => (
    <fieldset ref={ref} className={cn("grid gap-4", className)} {...props} />
  )
)
FieldSet.displayName = "FieldSet"

const FieldLegend = React.forwardRef<HTMLLegendElement, React.HTMLAttributes<HTMLLegendElement>>(
  ({ className, ...props }, ref) => (
    <legend ref={ref} className={cn("text-sm font-bold uppercase tracking-widest text-primary mb-2", className)} {...props} />
  )
)
FieldLegend.displayName = "FieldLegend"

const Field = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { orientation?: "vertical" | "horizontal" }>(
  ({ className, orientation = "vertical", ...props }, ref) => (
    <div 
      ref={ref} 
      className={cn(
        "grid gap-2", 
        orientation === "horizontal" ? "flex items-center gap-4" : "grid gap-2",
        className
      )} 
      {...props} 
    />
  )
)
Field.displayName = "Field"

const FieldLabel = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}
      {...props}
    />
  )
)
FieldLabel.displayName = "FieldLabel"

const FieldDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
)
FieldDescription.displayName = "FieldDescription"

const FieldSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("h-px w-full border-t", className)}
      {...props}
    />
  )
)
FieldSeparator.displayName = "FieldSeparator"

export { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator, FieldSet, FieldLegend }
