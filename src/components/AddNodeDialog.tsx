import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DecisionPath, TreeNode } from '@/lib/types'
import { generateId, hasCircularReference } from '@/lib/tree-utils'
import { useState, useEffect } from 'react'

interface AddNodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (branchLabel: string, node: TreeNode) => void
  paths: DecisionPath[]
  currentPathId: string
  mode: 'output' | 'edit'
  initialNode?: TreeNode
}

export function AddNodeDialog({ 
  open, 
  onOpenChange, 
  onAdd, 
  paths, 
  currentPathId,
  mode,
  initialNode
}: AddNodeDialogProps) {
  const [nodeType, setNodeType] = useState<'decision' | 'outcome' | 'path-reference' | 'condition'>('decision')
  const [outputLabel, setOutputLabel] = useState('')
  const [question, setQuestion] = useState('')
  const [description, setDescription] = useState('')
  const [selectedPathId, setSelectedPathId] = useState('')
  const [conditionLabel, setConditionLabel] = useState('')

  useEffect(() => {
    if (open && initialNode) {
      setNodeType(initialNode.type)
      if (initialNode.type === 'decision') {
        setQuestion(initialNode.question)
      } else if (initialNode.type === 'outcome') {
        setDescription(initialNode.description)
      } else if (initialNode.type === 'path-reference') {
        setSelectedPathId(initialNode.pathId)
      } else if (initialNode.type === 'condition') {
        setConditionLabel(initialNode.label)
      }
    } else if (open) {
      setOutputLabel('')
      setQuestion('')
      setDescription('')
      setSelectedPathId('')
      setConditionLabel('')
      setNodeType('decision')
    }
  }, [open, initialNode])

  const handleSubmit = () => {
    let node: TreeNode

    if (nodeType === 'decision') {
      node = {
        id: initialNode?.id || generateId(),
        type: 'decision',
        question: question.trim(),
        branches: initialNode?.type === 'decision' ? initialNode.branches : []
      }
    } else if (nodeType === 'condition') {
      const childNode = initialNode?.type === 'condition' ? initialNode.node : {
        id: generateId(),
        type: 'outcome' as const,
        description: ''
      }
      node = {
        id: initialNode?.id || generateId(),
        type: 'condition',
        label: conditionLabel.trim(),
        node: childNode
      }
    } else if (nodeType === 'outcome') {
      node = {
        id: initialNode?.id || generateId(),
        type: 'outcome',
        description: description.trim()
      }
    } else {
      node = {
        id: initialNode?.id || generateId(),
        type: 'path-reference',
        pathId: selectedPathId
      }
    }

    onAdd(outputLabel.trim(), node)
    onOpenChange(false)
  }

  const isValid = () => {
    if (mode === 'output' && !outputLabel.trim()) return false
    if (nodeType === 'decision' && !question.trim()) return false
    if (nodeType === 'condition' && !conditionLabel.trim()) return false
    if (nodeType === 'outcome' && !description.trim()) return false
    if (nodeType === 'path-reference' && !selectedPathId) return false
    if (nodeType === 'path-reference' && hasCircularReference(paths, currentPathId, selectedPathId)) return false
    return true
  }

  const availablePaths = paths.filter(p => p.id !== currentPathId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Edit Node' : 'Add Output'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit' 
              ? 'Update the node details below.'
              : 'Add an output to this decision point.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {mode === 'output' && (
            <div className="space-y-2">
              <Label htmlFor="output-label">Output Label</Label>
              <Input
                id="output-label"
                placeholder="e.g., Yes, No, Maybe"
                value={outputLabel}
                onChange={(e) => setOutputLabel(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="node-type">Node Type</Label>
            <Select value={nodeType} onValueChange={(value: any) => setNodeType(value)}>
              <SelectTrigger id="node-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="decision">Decision (Diamond)</SelectItem>
                <SelectItem value="condition">Condition (Box)</SelectItem>
                <SelectItem value="outcome">Outcome (Rounded)</SelectItem>
                <SelectItem value="path-reference">Path Reference (Rectangle)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {nodeType === 'decision' && (
            <div className="space-y-2">
              <Label htmlFor="question">Question</Label>
              <Textarea
                id="question"
                placeholder="What question should this decision answer?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {nodeType === 'condition' && (
            <div className="space-y-2">
              <Label htmlFor="condition-label">Condition Label</Label>
              <Input
                id="condition-label"
                placeholder="e.g., Yes, No, Approved, Verified"
                value={conditionLabel}
                onChange={(e) => setConditionLabel(e.target.value)}
              />
            </div>
          )}

          {nodeType === 'outcome' && (
            <div className="space-y-2">
              <Label htmlFor="description">Outcome Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the final outcome"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {nodeType === 'path-reference' && (
            <div className="space-y-2">
              <Label htmlFor="path-reference">Reference Path</Label>
              <Select value={selectedPathId} onValueChange={setSelectedPathId}>
                <SelectTrigger id="path-reference">
                  <SelectValue placeholder="Select a path to reference" />
                </SelectTrigger>
                <SelectContent>
                  {availablePaths.map(path => (
                    <SelectItem 
                      key={path.id} 
                      value={path.id}
                      disabled={hasCircularReference(paths, currentPathId, path.id)}
                    >
                      {path.name}
                      {hasCircularReference(paths, currentPathId, path.id) && ' (circular ref)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availablePaths.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No other paths available to reference. Create more paths first.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid()}>
            {mode === 'edit' ? 'Update' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
