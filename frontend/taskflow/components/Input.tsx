import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function InputDemo(label : string , description? : string,placeholder? : string) {
  return (
    <Field>
      <FieldLabel htmlFor="input-demo-api-key">{label}</FieldLabel>
      <Input id="input-demo-api-key" type="password" placeholder={placeholder || "..."} />
      <FieldDescription>
        {description}
      </FieldDescription>
    </Field>
  )
}
