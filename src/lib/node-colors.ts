export interface NodeColors {
  decision: string
  decisionForeground: string
  outcome: string
  outcomeForeground: string
  pathRef: string
  pathRefForeground: string
  accent: string
  accentForeground: string
}

export const DEFAULT_COLORS: NodeColors = {
  decision: 'oklch(0.70 0.15 70)',
  decisionForeground: 'oklch(0.25 0.05 70)',
  outcome: 'oklch(0.65 0.15 145)',
  outcomeForeground: 'oklch(0.25 0.08 145)',
  pathRef: 'oklch(0.60 0.15 290)',
  pathRefForeground: 'oklch(0.25 0.05 290)',
  accent: 'oklch(0.65 0.18 210)',
  accentForeground: 'oklch(0.25 0.05 250)',
}
