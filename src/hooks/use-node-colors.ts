import { useKV } from '@github/spark/hooks'
import { NodeColors, DEFAULT_COLORS } from '@/components/ColorSettings'

export function useNodeColors(): NodeColors {
  const [colors] = useKV<NodeColors>('node-colors', DEFAULT_COLORS)
  return colors || DEFAULT_COLORS
}
