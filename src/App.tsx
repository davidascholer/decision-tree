import { useKV } from '@github/spark/hooks'
import { DecisionPath, TreeNode } from './lib/types'
import { generateId, createExamplePaths, generateTextRepresentation, isPathReferencedByOthers } from './lib/tree-utils'
import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { Input } from './components/ui/input'
import { Plus, Trash, List, Tree, Download, Upload, Code, Copy, Sparkle, TextAa, ArrowCounterClockwise, ArrowClockwise, Warning, Question, DiamondsFour, CheckCircle, FlowArrow } from '@phosphor-icons/react'
import { useState, useRef, useEffect } from 'react'
import { TreeNodeEditor } from './components/TreeNodeEditor'
import { Flowchart } from './components/Flowchart'
import { SyntaxHighlightedText } from './components/SyntaxHighlightedText'
import { toast } from 'sonner'
import { Toaster } from './components/ui/sonner'
import { useUndoRedo } from './hooks/use-undo-redo'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './components/ui/alert-dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './components/ui/popover'

function App() {
  const [paths, setPaths] = useKV<DecisionPath[]>('decision-paths', [])
  const [selectedPathId, setSelectedPathId] = useState<string | undefined>(undefined)
  const [newPathName, setNewPathName] = useState('')
  const [showNewPathInput, setShowNewPathInput] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pathToDelete, setPathToDelete] = useState<{ id: string; name: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentPaths = paths || []

  const { canUndo, canRedo, undo, redo, pushState } = useUndoRedo<DecisionPath[]>(
    currentPaths,
    (newPaths) => {
      setPaths(newPaths)
    },
    { maxHistorySize: 50 }
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        if (canUndo) {
          toast.info('Undo')
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
        if (canRedo) {
          toast.info('Redo')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, canUndo, canRedo])

  const handleAddPath = () => {
    if (!newPathName.trim()) return

    const newPath: DecisionPath = {
      id: generateId(),
      name: newPathName.trim(),
      type: 'decision',
      description: 'Start',
    }

    const newPaths = [...currentPaths, newPath]
    setPaths(newPaths)
    pushState(newPaths)
    setSelectedPathId(newPath.id)
    setNewPathName('')
    setShowNewPathInput(false)
    toast.success(`Path "${newPath.name}" created`)
  }

  const handleDeletePath = (pathId: string) => {
    const path = currentPaths.find(p => p.id === pathId)
    if (!path) return
    
    const { isReferenced, referencedBy } = isPathReferencedByOthers(pathId, currentPaths)
    
    if (isReferenced) {
      toast.error(
        `Cannot delete "${path.name}". This path is referenced by: ${referencedBy.join(', ')}. Remove all references first.`,
        { duration: 5000 }
      )
      return
    }
    
    setPathToDelete({ id: pathId, name: path.name })
    setDeleteDialogOpen(true)
  }

  const confirmDeletePath = () => {
    if (!pathToDelete) return
    
    const newPaths = currentPaths.filter(p => p.id !== pathToDelete.id)
    setPaths(newPaths)
    pushState(newPaths)
    if (selectedPathId === pathToDelete.id) {
      setSelectedPathId(undefined)
    }
    toast.success(`Path "${pathToDelete.name}" deleted`)
    setDeleteDialogOpen(false)
    setPathToDelete(null)
  }

  const cancelDeletePath = () => {
    setDeleteDialogOpen(false)
    setPathToDelete(null)
  }

  const handleUpdatePath = (pathId: string, updatedPath: DecisionPath) => {
    const newPaths = currentPaths.map(path =>
      path.id === pathId ? updatedPath : path
    )
    setPaths(newPaths)
    pushState(newPaths)
  }

  const handleExportJSON = () => {
    const dataStr = JSON.stringify({ paths: currentPaths }, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `decision-trees-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Decision trees exported to JSON')
  }

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content)
        
        if (!data.paths || !Array.isArray(data.paths)) {
          toast.error('Invalid JSON format: must contain a "paths" array')
          return
        }

        setPaths(data.paths)
        pushState(data.paths)
        toast.success(`Imported ${data.paths.length} decision tree(s)`)
        
        if (data.paths.length > 0 && !selectedPathId) {
          setSelectedPathId(data.paths[0].id)
        }
      } catch (error) {
        toast.error('Failed to parse JSON file')
      }
    }
    reader.readAsText(file)
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCopyJSON = () => {
    if (!selectedPath) return
    
    const jsonString = JSON.stringify(selectedPath, null, 2)
    navigator.clipboard.writeText(jsonString)
    toast.success('JSON copied to clipboard')
  }

  const handleCopyText = () => {
    if (!selectedPath) return
    
    const textRepresentation = generateTextRepresentation(selectedPath, currentPaths)
    navigator.clipboard.writeText(textRepresentation)
    toast.success('Text representation copied to clipboard')
  }

  const handleLoadExample = () => {
    const examplePaths = createExamplePaths()
    const newPaths = [...currentPaths, ...examplePaths]
    setPaths(newPaths)
    pushState(newPaths)
    setSelectedPathId(examplePaths[1].id)
    toast.success('Example paths loaded! Check out "Request Processing"')
  }

  const selectedPath = selectedPathId ? currentPaths.find(p => p.id === selectedPathId) : undefined

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImportJSON}
        className="hidden"
      />
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="border-2 border-accent/20">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-destructive/10">
                <Warning size={24} className="text-destructive" weight="duotone" />
              </div>
              <AlertDialogTitle className="text-xl">Delete Decision Path?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base">
              Are you sure you want to delete <span className="font-semibold text-foreground">"{pathToDelete?.name}"</span>? 
              This action cannot be undone and all decision logic within this path will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDeletePath}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeletePath}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Path
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <div className="container mx-auto p-6 max-w-7xl">
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-primary mb-2">Decision Tree Visualizer</h1>
              <p className="text-muted-foreground text-lg">
                Create and visualize complex decision logic with flowchart-style diagrams
              </p>
            </div>
            <div className="flex gap-2">
              <div className="flex gap-1 border-r pr-2 mr-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={undo}
                  disabled={!canUndo}
                  title="Undo (Ctrl+Z)"
                >
                  <ArrowCounterClockwise />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={redo}
                  disabled={!canRedo}
                  title="Redo (Ctrl+Y)"
                >
                  <ArrowClockwise />
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={handleLoadExample}
                title="Load Example Path"
              >
                <Sparkle />
                Example
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                title="Import JSON"
              >
                <Upload />
                Import
              </Button>
              <Button
                variant="outline"
                onClick={handleExportJSON}
                disabled={currentPaths.length === 0}
                title="Export as JSON"
              >
                <Download />
                Export
              </Button>
            </div>
          </div>
        </header>

        {currentPaths.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Tree size={64} className="text-muted-foreground mb-4" weight="duotone" />
              <h3 className="text-xl font-semibold mb-2">No Decision Paths Yet</h3>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                Create your first decision path to start building your logic tree
              </p>
              <div className="flex gap-3 items-center">
                <Input
                  placeholder="Enter path name..."
                  value={newPathName}
                  onChange={(e) => setNewPathName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPath()}
                  className="w-64"
                />
                <Button onClick={handleAddPath} disabled={!newPathName.trim()}>
                  <Plus />
                  Create Path
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Paths</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowNewPathInput(!showNewPathInput)}
                    >
                      <Plus />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {showNewPathInput && (
                    <div className="flex gap-2 mb-4">
                      <Input
                        placeholder="Path name..."
                        value={newPathName}
                        onChange={(e) => setNewPathName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddPath()}
                        autoFocus
                      />
                      <Button size="sm" onClick={handleAddPath} disabled={!newPathName.trim()}>
                        <Plus />
                      </Button>
                    </div>
                  )}
                  
                  {currentPaths.map(path => (
                    <div
                      key={path.id}
                      className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        selectedPathId === path.id
                          ? 'bg-primary/10 border-primary'
                          : 'bg-card border-border hover:bg-muted'
                      }`}
                      onClick={() => setSelectedPathId(path.id)}
                    >
                      <div className="flex-1 truncate">
                        <div className="font-medium">{path.name}</div>
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {path.id}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeletePath(path.id)
                        }}
                        className="ml-2 h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-3">
              {selectedPath ? (
                <Tabs defaultValue="editor" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 mb-6">
                    <TabsTrigger value="editor" className="flex items-center gap-2">
                      <List />
                      <span>Editor</span>
                    </TabsTrigger>
                    <TabsTrigger value="flowchart" className="flex items-center gap-2">
                      <Tree />
                      <span>Flowchart</span>
                    </TabsTrigger>
                    <TabsTrigger value="text" className="flex items-center gap-2">
                      <TextAa />
                      <span>Text</span>
                    </TabsTrigger>
                    <TabsTrigger value="json" className="flex items-center gap-2">
                      <Code />
                      <span>JSON</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="editor">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>{selectedPath.name}</CardTitle>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Question />
                                Help
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[500px]" align="end">
                              <div className="space-y-4">
                                <div>
                                  <h4 className="font-semibold text-sm mb-3">Node Types</h4>
                                  <div className="space-y-3">
                                    <div className="flex gap-3">
                                      <div className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: 'oklch(0.70 0.15 70)' }}>
                                        <DiamondsFour weight="fill" size={20} style={{ color: 'oklch(0.25 0.05 70)' }} />
                                      </div>
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">Decision</div>
                                        <div className="text-xs text-muted-foreground">A decision point that branches based on multiple conditions. Each condition evaluates to true or false and directs the flow accordingly.</div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex gap-3">
                                      <div className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: 'oklch(0.65 0.18 210)' }}>
                                        <CheckCircle weight="fill" size={20} style={{ color: 'oklch(0.25 0.05 250)' }} />
                                      </div>
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">Condition</div>
                                        <div className="text-xs text-muted-foreground">A specific condition or criteria that must be evaluated. Conditions are attached to decision nodes and represent different possible paths.</div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex gap-3">
                                      <div className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: 'oklch(0.65 0.15 145)' }}>
                                        <CheckCircle weight="fill" size={20} style={{ color: 'oklch(0.25 0.08 145)' }} />
                                      </div>
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">Outcome</div>
                                        <div className="text-xs text-muted-foreground">A final result or action that ends a decision path. Outcomes represent the conclusion of a logical flow and do not branch further.</div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex gap-3">
                                      <div className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: 'oklch(0.60 0.15 290)' }}>
                                        <FlowArrow weight="fill" size={20} style={{ color: 'oklch(0.25 0.05 290)' }} />
                                      </div>
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">Path Reference</div>
                                        <div className="text-xs text-muted-foreground">A reference to another decision path. Use this to reuse existing logic or create modular decision trees that can be connected together.</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <TreeNodeEditor
                          path={selectedPath}
                          paths={currentPaths}
                          currentPathId={selectedPath.id}
                          onUpdatePath={(updatedPath) =>
                            handleUpdatePath(selectedPath.id, updatedPath)
                          }
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="flowchart">
                    <Card className="h-[600px]">
                      <CardContent className="p-0 h-full">
                        <Flowchart paths={currentPaths} selectedPathId={selectedPathId} />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="text">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>Text Representation</CardTitle>
                          <Button onClick={handleCopyText} variant="outline" size="sm">
                            <Copy />
                            Copy to Clipboard
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="relative">
                          <div className="bg-muted p-4 rounded-lg overflow-auto max-h-[500px]">
                            <SyntaxHighlightedText node={selectedPath} paths={currentPaths} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="json">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>Path JSON</CardTitle>
                          <Button onClick={handleCopyJSON} variant="outline" size="sm">
                            <Copy />
                            Copy to Clipboard
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="relative">
                          <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[500px] text-sm font-mono">
                            <code>{JSON.stringify(selectedPath, null, 2)}</code>
                          </pre>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              ) : (
                <Card className="border-2 border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <List size={48} className="text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Path Selected</h3>
                    <p className="text-muted-foreground">
                      Select a path from the sidebar to start editing
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App