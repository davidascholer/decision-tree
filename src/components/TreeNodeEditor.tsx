import { TreeNode, DecisionPath } from '@/lib/types'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash, Pencil, DiamondsFour, CheckCircle, FlowArrow } from '@phosphor-icons/react'
import { useState } from 'react'
import { AddNodeDialog } from './AddNodeDialog'
import { generateId } from '@/lib/tree-utils'
import { useNodeColors } from '@/hooks/use-node-colors'
import { toast } from 'sonner'

interface TreeNodeEditorProps {
  node: TreeNode
  paths: DecisionPath[]
  currentPathId: string
  onUpdateNode: (node: TreeNode) => void
  onDeleteBranch?: (branchId: string) => void
  depth?: number
}

export function TreeNodeEditor({ 
  node, 
  paths, 
  currentPathId,
  onUpdateNode, 
  onDeleteBranch,
  depth = 0 
}: TreeNodeEditorProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const colors = useNodeColors()

  const handleAddBranch = (branchLabel: string, branchNode: TreeNode) => {
    if (node.type === 'decision') {
      if (node.branches.length >= 1) {
        toast.error('A decision can only have one output')
        return
      }
      onUpdateNode({
        ...node,
        branches: [
          ...node.branches,
          {
            id: generateId(),
            label: branchLabel,
            node: branchNode
          }
        ]
      })
    }
  }

  const handleUpdateBranch = (branchId: string, updatedNode: TreeNode) => {
    if (node.type === 'decision') {
      onUpdateNode({
        ...node,
        branches: node.branches.map(branch =>
          branch.id === branchId
            ? { ...branch, node: updatedNode }
            : branch
        )
      })
    }
  }

  const handleDeleteBranch = (branchId: string) => {
    if (node.type === 'decision') {
      onUpdateNode({
        ...node,
        branches: node.branches.filter(b => b.id !== branchId)
      })
    }
  }

  const handleUpdateNode = (updates: Partial<TreeNode>) => {
    onUpdateNode({ ...node, ...updates } as TreeNode)
  }

  const getNodeIcon = (type: TreeNode['type']) => {
    switch (type) {
      case 'decision':
        return <DiamondsFour weight="fill" className="text-decision-foreground" />
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
      case 'outcome':
        return { bg: colors.outcome, fg: colors.outcomeForeground }
      case 'path-reference':
        return { bg: colors.pathRef, fg: colors.pathRefForeground }
    }
  }

  const getNodeLabel = (n: TreeNode) => {
    if (n.type === 'decision') return n.question
    if (n.type === 'outcome') return n.description
    if (n.type === 'path-reference') {
      const path = paths.find(p => p.id === n.pathId)
      return `→ ${path?.name || 'Unknown'}`
    }
  }

  if (node.type === 'decision') {
    const nodeColors = getNodeColor(node.type)
    return (
      <div className="space-y-2">
        <div 
          className="flex items-center gap-3 p-3 rounded-lg border-2" 
          style={{ backgroundColor: nodeColors.bg, color: nodeColors.fg, borderColor: nodeColors.fg }}
        >
          {getNodeIcon(node.type)}
          <div className="flex-1">
            <div className="font-medium">{node.question}</div>
            <div className="text-xs opacity-80 font-mono mt-1">ID: {node.id}</div>
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

        {node.branches.length > 0 && (
          <Accordion type="multiple" className="ml-6 border-l-2 border-border pl-4">
            {node.branches.map((branch) => (
              <AccordionItem key={branch.id} value={branch.id} className="border-none">
                <div className="flex items-center gap-2">
                  <AccordionTrigger className="flex-1 py-2 hover:no-underline">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Badge variant="outline" className="font-mono">
                        {branch.label}
                      </Badge>
                      <span className="text-muted-foreground truncate">
                        {getNodeLabel(branch.node)}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteBranch(branch.id)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash />
                  </Button>
                </div>
                <AccordionContent className="pb-4 pt-2">
                  <TreeNodeEditor
                    node={branch.node}
                    paths={paths}
                    currentPathId={currentPathId}
                    onUpdateNode={(updated) => handleUpdateBranch(branch.id, updated)}
                    onDeleteBranch={() => handleDeleteBranch(branch.id)}
                    depth={depth + 1}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        {node.branches.length === 0 && (
          <div className="ml-6 pl-4">
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
        )}

        <AddNodeDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          onAdd={handleAddBranch}
          paths={paths}
          currentPathId={currentPathId}
          mode="output"
        />

        <AddNodeDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onAdd={(_, newNode) => handleUpdateNode(newNode)}
          paths={paths}
          currentPathId={currentPathId}
          mode="edit"
          initialNode={node}
        />
      </div>
    )
  }

  if (node.type === 'outcome') {
    const nodeColors = getNodeColor(node.type)
    return (
      <div 
        className="flex items-center gap-3 p-3 rounded-lg border-2" 
        style={{ backgroundColor: nodeColors.bg, color: nodeColors.fg, borderColor: nodeColors.fg }}
      >
        {getNodeIcon(node.type)}
        <div className="flex-1">
          <div className="font-medium">{node.description}</div>
          <div className="text-xs opacity-80 font-mono mt-1">ID: {node.id}</div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setEditDialogOpen(true)}
          className="h-8 w-8 p-0"
        >
          <Pencil />
        </Button>
        <AddNodeDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onAdd={(_, newNode: TreeNode) => handleUpdateNode(newNode)}
          paths={paths}
          currentPathId={currentPathId}
          mode="edit"
          initialNode={node}
        />
      </div>
    )
  }

  if (node.type === 'path-reference') {
    const referencedPath = paths.find(p => p.id === node.pathId)
    const nodeColors = getNodeColor(node.type)
    return (
      <div 
        className="flex items-center gap-3 p-3 rounded-lg border-2" 
        style={{ backgroundColor: nodeColors.bg, color: nodeColors.fg, borderColor: nodeColors.fg }}
      >
        {getNodeIcon(node.type)}
        <div className="flex-1">
          <div className="font-medium">References: {referencedPath?.name || 'Unknown Path'}</div>
          <div className="text-xs opacity-80 font-mono mt-1">Path ID: {node.pathId}</div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setEditDialogOpen(true)}
          className="h-8 w-8 p-0"
        >
          <Pencil />
        </Button>
        <AddNodeDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onAdd={(_, newNode: TreeNode) => handleUpdateNode(newNode)}
          paths={paths}
          currentPathId={currentPathId}
          mode="edit"
          initialNode={node}
        />
      </div>
    )
  }

  return null
}
