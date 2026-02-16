export const BUTTON_BASE =
  "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"

export const BUTTON_PRIMARY = `${BUTTON_BASE} bg-primary text-primary-foreground hover:opacity-90`

export const BUTTON_SECONDARY = `${BUTTON_BASE} border border-border bg-background text-foreground hover:bg-accent`

export const BUTTON_DANGER = `${BUTTON_BASE} border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300`

export const BUTTON_ICON = "inline-flex items-center justify-center rounded-lg border border-border bg-background p-2 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
