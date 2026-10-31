type Props = {
  href?: string
  label?: string
}

export function Wordmark({
  href = "#top",
  label = "Recon, back to the top",
}: Props) {
  return (
    <a href={href} className="group flex shrink-0 items-center gap-2.5" aria-label={label}>
      <span
        aria-hidden="true"
        className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground"
      >
        <span className="font-mono text-[0.7rem] leading-none font-bold">R</span>
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-sm font-semibold tracking-tight">Recon</span>
        <span className="mt-1 font-mono text-[0.5rem] tracking-[0.2em] text-muted-foreground uppercase">
          commerce analyst
        </span>
      </span>
    </a>
  )
}
