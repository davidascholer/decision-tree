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
  decision: 'oklch(0.72 0.15 195)',
  decisionForeground: 'oklch(0.98 0 0)',
  outcome: 'oklch(0.75 0.12 160)',
  outcomeForeground: 'oklch(0.98 0 0)',
  pathRef: 'oklch(0.68 0.18 280)',
  pathRefForeground: 'oklch(0.98 0 0)',
  accent: 'oklch(0.88 0.08 210)',
  accentForeground: 'oklch(0.25 0.05 210)',
}
