import { TreeNode, DecisionPath } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash, Pencil, DiamondsFour, CheckCircle, FlowArrow, CaretDown, CaretRight, WarningCircle, NotePencil } from '@phosphor-icons/react'
import { useState, useMemo } from 'react'
import { AddNodeDialog } from './AddNodeDialog'
import { generateId, findIncompleteConditions, collectNotedNodes } from '@/lib/tree-utils'
import { useNodeColors } from '@/hooks/use-node-colors'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface TreeNodeEditorProps {
  path: DecisionPath
  paths: DecisionPath[]
  currentPathId: string
  onUpdatePath: (path: DecisionPath) => void
  depth?: number
  onDeleteNode?: () => void
}

export function TreeNodeEditor({ 
  path, 
  paths, 
  currentPathId,
  onUpdatePath, 
  depth = 0,
  onDeleteNode
}: TreeNodeEditorProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editConditionDialogOpen, setEditConditionDialogOpen] = useState(false)
  const [conditionToEdit, setConditionToEdit] = useState<Extract<TreeNode, { type: 'condition' }> | null>(null)
  const [isExpanded, setIsExpanded] = useState(true)
  const colors = useNodeColors()

  const citationMap = useMemo(() => {
    const noted = collectNotedNodes(path)
    const map = new Map<string, number>()
    noted.forEach((item, i) => map.set(item.id, i + 1))
    return map
  }, [path])

  const notedNodes = useMemo(() => collectNotedNodes(path), [path])
  
  const incompleteConditionIds = useMemo(() => {
    return new Set(findIncompleteConditions(path))
  }, [path])

  const hasChildren = (node: DecisionPath | TreeNode): boolean => {
    if (node.type === 'decision') {
      return (node.conditions && node.conditions.length > 0) || false
    }
    if (node.type === 'condition') {
      return !!node.next
    }
    return false
  }

  const handleDelete = () => {
    if (hasChildren(path)) {
      toast.error('Cannot delete node with children. Delete all child nodes first.')
      return
    }
    if (onDeleteNode) {
      onDeleteNode()
    }
  }

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
      const conditionToDelete = conditions.find(c => c.id === conditionId)
      
      if (conditionToDelete && conditionToDelete.next) {
        toast.error('Cannot delete condition with children. Delete the child node first.')
        return
      }
      
      onUpdatePath({
        ...path,
        conditions: conditions.filter(c => c.id !== conditionId)
      })
      toast.success('Condition deleted')
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
    if (n.type === 'decision') return n.description
    if (n.type === 'condition') return n.description
    if (n.type === 'outcome') return n.description
    if (n.type === 'path-reference') {
      const p = paths.find(p => p.id === n.pathId)
      return `→ ${p?.name || 'Unknown'}`
    }
  }

  if (path.type === 'decision') {
    const nodeColors = getNodeColor(path.type)
    const canDelete = depth > 0 && onDeleteNode
    const hasIncompleteConditions = incompleteConditionIds.size > 0
    
    return (
      <div className="space-y-2">
        {hasIncompleteConditions && depth === 0 && (
          <Alert variant="destructive" className="border-2">
            <WarningCircle className="h-5 w-5" weight="fill" />
            <AlertTitle>Incomplete Decision Tree</AlertTitle>
            <AlertDescription>
              This tree has {incompleteConditionIds.size} incomplete condition{incompleteConditionIds.size !== 1 ? 's' : ''} that need{incompleteConditionIds.size === 1 ? 's' : ''} an outcome or path reference. 
              Every condition branch must end with either an outcome or a path reference.
            </AlertDescription>
          </Alert>
        )}
        
        <div 
          className="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer hover:opacity-90 transition-opacity" 
          style={{ backgroundColor: nodeColors.bg, color: nodeColors.fg, borderColor: nodeColors.fg }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {hasChildren(path) && (
            <div className="flex-shrink-0">
              {isExpanded ? <CaretDown size={20} /> : <CaretRight size={20} />}
            </div>
          )}
          {getNodeIcon(path.type)}
          <div className="flex-1">
            <div className="font-medium">
              {path.description}
              {citationMap.has(path.id) && (
                <span className="ml-1.5 text-xs font-bold font-mono text-current select-none">[{citationMap.get(path.id)}]</span>
              )}
            </div>
            <div className="text-xs opacity-80 font-mono mt-1">ID: {path.id}</div>
          </div>
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditDialogOpen(true)}
              className="h-8 w-8 p-0"
              title="Edit node"
            >
              <Pencil />
            </Button>
            {canDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDelete}
                className="h-8 w-8 p-0"
                title={hasChildren(path) ? "Cannot delete - has children" : "Delete node"}
                disabled={hasChildren(path)}
              >
                <Trash className={hasChildren(path) ? 'opacity-30' : ''} />
              </Button>
            )}
          </div>
        </div>

        {isExpanded && (
          <>
            {path.conditions && path.conditions.length > 0 && (
              <div className="ml-6 space-y-3">
                {path.conditions.map((condition) => {
                  const isIncomplete = incompleteConditionIds.has(condition.id)
                  return (
                    <div key={condition.id} className="border-l-2 border-border pl-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={`font-mono ${isIncomplete ? 'border-destructive text-destructive border-2 animate-pulse' : ''}`}
                          >
                            {condition.description}
                            {citationMap.has(condition.id) && (
                              <span className="ml-1 text-xs font-bold text-current select-none">[{citationMap.get(condition.id)}]</span>
                            )}
                          </Badge>
                          {isIncomplete && (
                            <div className="flex items-center gap-1 text-destructive text-xs font-medium">
                              <WarningCircle size={16} weight="fill" />
                              <span>Missing end node</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setConditionToEdit(condition)
                              setEditConditionDialogOpen(true)
                            }}
                            className="h-8 w-8 p-0"
                            title="Edit condition"
                          >
                            <Pencil />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteCondition(condition.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            title={condition.next ? "Cannot delete - has children" : "Delete condition"}
                            disabled={!!condition.next}
                          >
                            <Trash className={condition.next ? 'opacity-30' : ''} />
                          </Button>
                        </div>
                      </div>
                      {condition.type === 'condition' && (
                        <div className="ml-4">
                          <ConditionNodeEditor
                            condition={condition}
                            paths={paths}
                            currentPathId={currentPathId}
                            onUpdateCondition={(updated) => 
                              handleUpdateCondition(condition.id, updated)
                            }
                            depth={depth + 1}
                            citationMap={citationMap}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
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
                Add Condition
              </Button>
            </div>
          </>
        )}

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

        {conditionToEdit && (
          <AddNodeDialog
            open={editConditionDialogOpen}
            onOpenChange={setEditConditionDialogOpen}
            onAdd={(_, updatedNode) => {
              handleUpdateCondition(conditionToEdit.id, updatedNode as any)
              setConditionToEdit(null)
            }}
            paths={paths}
            currentPathId={currentPathId}
            mode="edit"
            initialNode={conditionToEdit}
          />
        )}

        {notedNodes.length > 0 && (
          <div className="mt-6 pt-4 border-t-2 border-border">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <NotePencil size={15} />
              <span>Notes</span>
            </div>
            <ol className="space-y-2">
              {notedNodes.map((item, i) => (
                <li key={item.id} className="flex gap-2.5 text-sm">
                  <span className="shrink-0 font-bold font-mono text-current">[{i + 1}]</span>
                  <span className="text-muted-foreground italic">{item.note}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
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
  onDeleteNode?: () => void
  depth: number
  citationMap: Map<string, number>
}

function ConditionNodeEditor({ 
  condition, 
  paths, 
  currentPathId,
  onUpdateCondition,
  onDeleteNode,
  depth,
  citationMap
}: ConditionNodeEditorProps) {
  const [addChildOpen, setAddChildOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)
  const colors = useNodeColors()

  const hasChildren = (node: TreeNode): boolean => {
    if (node.type === 'decision') {
      return (node.conditions && node.conditions.length > 0) || false
    }
    if (node.type === 'condition') {
      return !!node.next
    }
    return false
  }

  const handleDeleteChild = () => {
    if (condition.next && hasChildren(condition.next)) {
      toast.error('Cannot delete node with children. Delete all child nodes first.')
      return
    }
    
    onUpdateCondition({ ...condition, next: undefined })
    toast.success('Node deleted')
  }

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
    if (n.type === 'decision') return n.description
    if (n.type === 'condition') return n.description
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
            className="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer hover:opacity-90 transition-opacity" 
            style={{ backgroundColor: getNodeColor(next.type).bg, color: getNodeColor(next.type).fg, borderColor: getNodeColor(next.type).fg }}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {hasChildren(next) && (
              <div className="flex-shrink-0">
                {isExpanded ? <CaretDown size={20} /> : <CaretRight size={20} />}
              </div>
            )}
            {getNodeIcon(next.type)}
            <div className="flex-1">
              <div className="font-medium">
                {next.description}
                {citationMap.has(next.id) && (
                  <span className="ml-1.5 text-xs font-bold font-mono text-current select-none">[{citationMap.get(next.id)}]</span>
                )}
              </div>
              <div className="text-xs opacity-80 font-mono mt-1">ID: {next.id}</div>
            </div>
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditDialogOpen(true)}
                className="h-8 w-8 p-0"
                title="Edit node"
              >
                <Pencil />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDeleteChild}
                className="h-8 w-8 p-0"
                title={hasChildren(next) ? "Cannot delete - has children" : "Delete node"}
                disabled={hasChildren(next)}
              >
                <Trash className={hasChildren(next) ? 'opacity-30' : ''} />
              </Button>
            </div>
          </div>

          {isExpanded && (
            <>
              {next.conditions && next.conditions.length > 0 && (
                <div className="ml-6 space-y-3">
                  {next.conditions.map((cond) => (
                    <div key={cond.id} className="border-l-2 border-border pl-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="font-mono">
                          {cond.description}
                          {citationMap.has(cond.id) && (
                            <span className="ml-1 text-xs font-bold text-current select-none">[{citationMap.get(cond.id)}]</span>
                          )}
                        </Badge>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const updatedConditions = (next.conditions || []).filter(c => c.id !== cond.id)
                              onUpdateCondition({
                                ...condition,
                                next: {
                                  ...next,
                                  conditions: updatedConditions
                                }
                              })
                              toast.success('Condition deleted')
                            }}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            title={cond.next ? "Cannot delete - has children" : "Delete condition"}
                            disabled={!!cond.next}
                          >
                            <Trash className={cond.next ? 'opacity-30' : ''} />
                          </Button>
                        </div>
                      </div>
                      <div className="ml-4">
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
                          citationMap={citationMap}
                        />
                      </div>
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
                  Add Condition
                </Button>
              </div>
            </>
          )}

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
            <div className="font-medium">
              {getNodeLabel(next)}
              {citationMap.has(next.id) && (
                <span className="ml-1.5 text-xs font-bold font-mono text-current select-none">[{citationMap.get(next.id)}]</span>
              )}
            </div>
            <div className="text-xs opacity-80 font-mono mt-1">ID: {next.id}</div>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditDialogOpen(true)}
              className="h-8 w-8 p-0"
              title="Edit node"
            >
              <Pencil />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDeleteChild}
              className="h-8 w-8 p-0"
              title="Delete node"
            >
              <Trash />
            </Button>
          </div>
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
