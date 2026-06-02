import { TreeNode, DecisionPath } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash, Pencil, DiamondsFour, CheckCircle, FlowArrow } from '@phosphor-icons/react'
import { useState } from 'react'
import { AddNodeDialog } from './AddNodeDialog'
import { generateId } from '@/lib/tree-utils'
import { useNodeColors } from '@/hooks/use-node-colors'
import { toast } from 'sonner'

interface TreeNodeEditorProps {
  path: DecisionPath
  paths: DecisionPath[]
  currentPathId: string
  onUpdatePath: (path: DecisionPath) => void
  depth?: number
}

export function TreeNodeEditor({ 
  path, 
  paths, 
  currentPathId,
  onUpdatePath, 
  depth = 0 
}: TreeNodeEditorProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const colors = useNodeColors()

  const handleAddCondition = (_: string, conditionNode: TreeNode) => {
    if (path.type === 'decision') {
      const conditions = path.conditions || []
      onUpdatePath({
        ...path,
        conditions: [...conditions, conditionNode as any]
      })
    }
  }

  const handleUpdatePath = (updates: Partial<DecisionPath>) => {
    onUpdatePath({ ...path, ...updates } as DecisionPath)
  }

  const handleDeleteCondition = (conditionId: string) => {
    if (path.type === 'decision') {
      const conditions = path.conditions || []
      onUpdatePath({
        ...path,
        conditions: conditions.filter(c => c.id !== conditionId)
      })
    }
  }

  const handleUpdateCondition = (conditionId: string, updatedCondition: any) => {
    if (path.type === 'decision') {
      const conditions = path.conditions || []
      onUpdatePath({
        ...path,
        conditions: conditions.map(c => c.id === conditionId ? updatedCondition : c)
      })
    }
  }

  const getNodeIcon = (type: TreeNode['type'] | 'decision') => {
    switch (type) {
      case 'decision':
        return <DiamondsFour weight="fill" className="text-decision-foreground" />
      case 'condition':
        return <CheckCircle weight="fill" className="text-accent-foreground" />
      case 'outcome':
        return <CheckCircle weight="fill" className="text-outcome-foreground" />
      case 'path-reference':
        return <FlowArrow weight="fill" className="text-path-ref-foreground" />
    }
  }

  const getNodeColor = (type: TreeNode['type'] | 'decision') => {
    switch (type) {
      case 'decision':
        return { bg: colors.decision, fg: colors.decisionForeground }
      case 'condition':
        return { bg: colors.accent, fg: colors.accentForeground }
      case 'outcome':
        return { bg: colors.outcome, fg: colors.outcomeForeground }
      case 'path-reference':
        return { bg: colors.pathRef, fg: colors.pathRefForeground }
    }
  }

  const getNodeLabel = (n: TreeNode | DecisionPath) => {
    if (n.type === 'decision') return n.question
    if (n.type === 'condition') return n.label
    if (n.type === 'outcome') return n.description
    if (n.type === 'path-reference') {
      const p = paths.find(p => p.id === n.pathId)
      return `→ ${p?.name || 'Unknown'}`
    }
  }

  if (path.type === 'decision') {
    const nodeColors = getNodeColor(path.type)
    return (
      <div className="space-y-2">
        <div 
          className="flex items-center gap-3 p-3 rounded-lg border-2" 
          style={{ backgroundColor: nodeColors.bg, color: nodeColors.fg, borderColor: nodeColors.fg }}
        >
          {getNodeIcon(path.type)}
          <div className="flex-1">
            <div className="font-medium">{path.question}</div>
            <div className="text-xs opacity-80 font-mono mt-1">ID: {path.id}</div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditDialogOpen(true)}
            className="h-8 w-8 p-0"
          >
            <Pencil />
          </Button>
        </div>

        {path.conditions && path.conditions.length > 0 && (
          <div className="ml-6 space-y-3">
            {path.conditions.map((condition) => (
              <div key={condition.id} className="border-l-2 border-border pl-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="font-mono">
                    {condition.label}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteCondition(condition.id)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash />
                  </Button>
                </div>
                {condition.type === 'condition' && (
                  <ConditionNodeEditor
                    condition={condition}
                    paths={paths}
                    currentPathId={currentPathId}
                    onUpdateCondition={(updated) => 
                      handleUpdateCondition(condition.id, updated)
                    }
                    depth={depth + 1}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="ml-6 pl-4 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddDialogOpen(true)}
            className="w-full"
          >
            <Plus />
            Add Output
          </Button>
        </div>

        <AddNodeDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          onAdd={handleAddCondition}
          paths={paths}
          currentPathId={currentPathId}
          mode="output"
          parentNodeType="decision"
        />

        <AddNodeDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onAdd={(_, newNode) => handleUpdatePath(newNode as any)}
          paths={paths}
          currentPathId={currentPathId}
          mode="edit"
          initialNode={path as any}
        />
      </div>
    )
  }

  return null
}

interface ConditionNodeEditorProps {
  condition: Extract<TreeNode, { type: 'condition' }>
  paths: DecisionPath[]
  currentPathId: string
  onUpdateCondition: (condition: Extract<TreeNode, { type: 'condition' }>) => void
  depth: number
}

function ConditionNodeEditor({ 
  condition, 
  paths, 
  currentPathId,
  onUpdateCondition,
  depth
}: ConditionNodeEditorProps) {
  const [addChildOpen, setAddChildOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const colors = useNodeColors()

  const handleAddChild = (_: string, newNode: TreeNode) => {
    onUpdateCondition({ ...condition, next: newNode })
  }

  const handleUpdateNode = (updates: Partial<TreeNode>) => {
    onUpdateCondition({ ...condition, ...updates } as any)
  }

  const getNodeIcon = (type: TreeNode['type']) => {
    switch (type) {
      case 'decision':
        return <DiamondsFour weight="fill" className="text-decision-foreground" />
      case 'condition':
        return <CheckCircle weight="fill" className="text-accent-foreground" />
      case 'outcome':
        return <CheckCircle weight="fill" className="text-outcome-foreground" />
      case 'path-reference':
        return <FlowArrow weight="fill" className="text-path-ref-foreground" />
    }
  }

  const getNodeColor = (type: TreeNode['type']) => {
    switch (type) {
      case 'decision':
        return { bg: colors.decision, fg: colors.decisionForeground }
      case 'condition':
        return { bg: colors.accent, fg: colors.accentForeground }
      case 'outcome':
        return { bg: colors.outcome, fg: colors.outcomeForeground }
      case 'path-reference':
        return { bg: colors.pathRef, fg: colors.pathRefForeground }
    }
  }

  const getNodeLabel = (n: TreeNode) => {
    if (n.type === 'decision') return n.question
    if (n.type === 'condition') return n.label
    if (n.type === 'outcome') return n.description
    if (n.type === 'path-reference') {
      const path = paths.find(p => p.id === n.pathId)
      return `→ ${path?.name || 'Unknown'}`
    }
  }

  if (condition.next) {
    const next = condition.next

    if (next.type === 'decision') {
      return (
        <div className="space-y-2">
          <div 
            className="flex items-center gap-3 p-3 rounded-lg border-2" 
            style={{ backgroundColor: getNodeColor(next.type).bg, color: getNodeColor(next.type).fg, borderColor: getNodeColor(next.type).fg }}
          >
            {getNodeIcon(next.type)}
            <div className="flex-1">
              <div className="font-medium">{next.question}</div>
              <div className="text-xs opacity-80 font-mono mt-1">ID: {next.id}</div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditDialogOpen(true)}
              className="h-8 w-8 p-0"
            >
              <Pencil />
            </Button>
          </div>

          {next.conditions && next.conditions.length > 0 && (
            <div className="ml-6 space-y-3">
              {next.conditions.map((cond) => (
                <div key={cond.id} className="border-l-2 border-border pl-4">
                  <div className="mb-2">
                    <Badge variant="outline" className="font-mono">
                      {cond.label}
                    </Badge>
                  </div>
                  <ConditionNodeEditor
                    condition={cond}
                    paths={paths}
                    currentPathId={currentPathId}
                    onUpdateCondition={(updated) => {
                      const updatedConditions = (next.conditions || []).map(c =>
                        c.id === cond.id ? updated : c
                      )
                      onUpdateCondition({
                        ...condition,
                        next: {
                          ...next,
                          conditions: updatedConditions
                        }
                      })
                    }}
                    depth={depth + 1}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="ml-6 pl-4 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddChildOpen(true)}
              className="w-full"
            >
              <Plus />
              Add Output
            </Button>
          </div>

          <AddNodeDialog
            open={addChildOpen}
            onOpenChange={setAddChildOpen}
            onAdd={(_, newCondition) => {
              const conditions = next.conditions || []
              onUpdateCondition({
                ...condition,
                next: {
                  ...next,
                  conditions: [...conditions, newCondition as any]
                }
              })
            }}
            paths={paths}
            currentPathId={currentPathId}
            mode="output"
            parentNodeType="decision"
          />

          <AddNodeDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            onAdd={(_, updatedNode) =>
              onUpdateCondition({ ...condition, next: updatedNode })
            }
            paths={paths}
            currentPathId={currentPathId}
            mode="edit"
            initialNode={next}
          />
        </div>
      )
    }

    const nodeColors = getNodeColor(next.type)
    return (
      <div>
        <div 
          className="flex items-center gap-3 p-3 rounded-lg border-2" 
          style={{ backgroundColor: nodeColors.bg, color: nodeColors.fg, borderColor: nodeColors.fg }}
        >
          {getNodeIcon(next.type)}
          <div className="flex-1">
            <div className="font-medium">{getNodeLabel(next)}</div>
            <div className="text-xs opacity-80 font-mono mt-1">ID: {next.id}</div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditDialogOpen(true)}
            className="h-8 w-8 p-0"
          >
            <Pencil />
          </Button>
        </div>

        <AddNodeDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onAdd={(_, updatedNode) =>
            onUpdateCondition({ ...condition, next: updatedNode })
          }
          paths={paths}
          currentPathId={currentPathId}
          mode="edit"
          initialNode={next}
        />
      </div>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setAddChildOpen(true)}
        className="w-full"
      >
        <Plus />
        Add Content
      </Button>
      
      <AddNodeDialog
        open={addChildOpen}
        onOpenChange={setAddChildOpen}
        onAdd={handleAddChild}
        paths={paths}
        currentPathId={currentPathId}
        mode="output"
        parentNodeType="condition"
      />
    </>
  )
}
