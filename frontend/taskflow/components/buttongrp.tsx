
import * as React from "react"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
export function ButtonGroupDemo() {

  return (
    <ButtonGroup>
      <ButtonGroup>
        <Button variant="outline">Todo</Button>
        <Button variant="outline">In Progress</Button>
        <Button variant="outline">Done</Button>
      </ButtonGroup>
    </ButtonGroup>
  )
}
