import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Label } from './ui/label'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { DiamondsFour, CheckCircle, FlowArrow, ArrowCounterClockwise } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { NodeColors, DEFAULT_COLORS } from '@/lib/node-colors'

const NODE_COLORS_STORAGE_KEY = 'node-colors'

export function ColorSettings() {
  const [colors, setColors] = useState<NodeColors>(() => {
    try {
      const stored = localStorage.getItem(NODE_COLORS_STORAGE_KEY)
      if (!stored) return DEFAULT_COLORS

      const parsed = JSON.parse(stored) as Partial<NodeColors>
      return { ...DEFAULT_COLORS, ...parsed }
    } catch {
      return DEFAULT_COLORS
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(NODE_COLORS_STORAGE_KEY, JSON.stringify(colors))
    } catch (error) {
      console.error('Failed to save node colors:', error)
    }
  }, [colors])

  const handleColorChange = (key: keyof NodeColors, value: string) => {
    setColors((current) => ({
      ...current,
      [key]: value
    }))
  }

  const handleReset = () => {
    setColors(DEFAULT_COLORS)
    toast.success('Colors reset to defaults')
  }

  const currentColors = colors

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Node Colors</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            title="Reset to defaults"
          >
            <ArrowCounterClockwise />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <DiamondsFour size={20} weight="fill" />
            <h4 className="font-semibold">Decision Nodes</h4>
          </div>
          <div className="space-y-2 pl-7">
            <div className="flex items-center gap-3">
              <Label htmlFor="decision-bg" className="w-32 text-sm">
                Background
              </Label>
              <Input
                id="decision-bg"
                type="text"
                value={currentColors.decision}
                onChange={(e) => handleColorChange('decision', e.target.value)}
                className="flex-1 font-mono text-xs"
              />
              <div
                className="w-10 h-10 rounded border-2 border-border shrink-0"
                style={{ backgroundColor: currentColors.decision }}
              />
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="decision-fg" className="w-32 text-sm">
                Text
              </Label>
              <Input
                id="decision-fg"
                type="text"
                value={currentColors.decisionForeground}
                onChange={(e) => handleColorChange('decisionForeground', e.target.value)}
                className="flex-1 font-mono text-xs"
              />
              <div
                className="w-10 h-10 rounded border-2 border-border shrink-0"
                style={{ backgroundColor: currentColors.decisionForeground }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={20} weight="fill" />
            <h4 className="font-semibold">Outcome Nodes</h4>
          </div>
          <div className="space-y-2 pl-7">
            <div className="flex items-center gap-3">
              <Label htmlFor="outcome-bg" className="w-32 text-sm">
                Background
              </Label>
              <Input
                id="outcome-bg"
                type="text"
                value={currentColors.outcome}
                onChange={(e) => handleColorChange('outcome', e.target.value)}
                className="flex-1 font-mono text-xs"
              />
              <div
                className="w-10 h-10 rounded border-2 border-border shrink-0"
                style={{ backgroundColor: currentColors.outcome }}
              />
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="outcome-fg" className="w-32 text-sm">
                Text
              </Label>
              <Input
                id="outcome-fg"
                type="text"
                value={currentColors.outcomeForeground}
                onChange={(e) => handleColorChange('outcomeForeground', e.target.value)}
                className="flex-1 font-mono text-xs"
              />
              <div
                className="w-10 h-10 rounded border-2 border-border shrink-0"
                style={{ backgroundColor: currentColors.outcomeForeground }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <FlowArrow size={20} weight="fill" />
            <h4 className="font-semibold">Path Reference Nodes</h4>
          </div>
          <div className="space-y-2 pl-7">
            <div className="flex items-center gap-3">
              <Label htmlFor="path-ref-bg" className="w-32 text-sm">
                Background
              </Label>
              <Input
                id="path-ref-bg"
                type="text"
                value={currentColors.pathRef}
                onChange={(e) => handleColorChange('pathRef', e.target.value)}
                className="flex-1 font-mono text-xs"
              />
              <div
                className="w-10 h-10 rounded border-2 border-border shrink-0"
                style={{ backgroundColor: currentColors.pathRef }}
              />
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="path-ref-fg" className="w-32 text-sm">
                Text
              </Label>
              <Input
                id="path-ref-fg"
                type="text"
                value={currentColors.pathRefForeground}
                onChange={(e) => handleColorChange('pathRefForeground', e.target.value)}
                className="flex-1 font-mono text-xs"
              />
              <div
                className="w-10 h-10 rounded border-2 border-border shrink-0"
                style={{ backgroundColor: currentColors.pathRefForeground }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
