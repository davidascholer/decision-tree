import { DecisionPath, TreeNode, SaveHistoryEntry } from './lib/types'
import { generateId, createExamplePaths, generateTextRepresentation, isPathReferencedByOthers } from './lib/tree-utils'
import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { Input } from './components/ui/input'
import { Plus, Trash, List, Tree, Download, Upload, Code, Copy, Sparkle, TextAa, ArrowCounterClockwise, ArrowClockwise, Warning, Question, DiamondsFour, CheckCircle, FlowArrow, PencilSimple, Check, X, CheckCircle as CheckCircleIcon, Clock, ClockCounterClockwise } from '@phosphor-icons/react'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './components/ui/popover'
import { ScrollArea } from './components/ui/scroll-area'
import { Textarea } from './components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu'

const STORAGE_KEY = 'decision-tree-paths'
const HISTORY_KEY = 'decision-tree-history'

function App() {
  const [paths, setPaths] = useState<DecisionPath[]>([])
  const [selectedPathId, setSelectedPathId] = useState<string | undefined>(undefined)
  const [newPathName, setNewPathName] = useState('')
  const [showNewPathInput, setShowNewPathInput] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pathToDelete, setPathToDelete] = useState<{ id: string; name: string } | null>(null)
  const [editingPathId, setEditingPathId] = useState<string | null>(null)
  const [editingPathName, setEditingPathName] = useState('')
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportJSON, setExportJSON] = useState('')
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importJSON, setImportJSON] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [timeDisplay, setTimeDisplay] = useState<string>('')
  const [saveHistory, setSaveHistory] = useState<SaveHistoryEntry[]>([])
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)

  const currentPaths = paths || []

  const countTotalNodes = (paths: DecisionPath[]): number => {
    let count = paths.length
    
    const countNodeChildren = (node: TreeNode): number => {
      let nodeCount = 1
      if ('conditions' in node && node.conditions) {
        node.conditions.forEach(condition => {
          nodeCount += 1
          if (condition.next) {
            nodeCount += countNodeChildren(condition.next)
          }
        })
      }
      return nodeCount
    }
    
    paths.forEach(path => {
      if ('conditions' in path && path.conditions) {
        path.conditions.forEach(condition => {
          count += 1
          if (condition.next) {
            count += countNodeChildren(condition.next)
          }
        })
      }
    })
    
    return count
  }

  const addToHistory = (action?: string) => {
    const newEntry: SaveHistoryEntry = {
      id: generateId(),
      timestamp: new Date(),
      pathCount: currentPaths.length,
      totalNodes: countTotalNodes(currentPaths),
      action
    }
    
    const updatedHistory = [newEntry, ...saveHistory].slice(0, 50)
    setSaveHistory(updatedHistory)
    
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory))
    } catch (error) {
      console.error('Failed to save history:', error)
    }
  }

  useEffect(() => {
    const loadFromLocalStorage = () => {
      try {
        const storedData = localStorage.getItem(STORAGE_KEY)
        if (storedData) {
          const parsedPaths = JSON.parse(storedData)
          if (Array.isArray(parsedPaths)) {
            setPaths(parsedPaths)
            if (parsedPaths.length > 0) {
              toast.success(`Loaded ${parsedPaths.length} decision tree(s) from localStorage`)
            }
          }
        }
        
        const storedHistory = localStorage.getItem(HISTORY_KEY)
        if (storedHistory) {
          const parsedHistory = JSON.parse(storedHistory)
          if (Array.isArray(parsedHistory)) {
            const historyWithDates = parsedHistory.map(entry => ({
              ...entry,
              timestamp: new Date(entry.timestamp)
            }))
            setSaveHistory(historyWithDates)
          }
        }
      } catch (error) {
        console.error('Failed to load from localStorage:', error)
        toast.error('Failed to load saved data')
      } finally {
        setIsInitialized(true)
      }
    }

    if (!isInitialized) {
      loadFromLocalStorage()
    }
  }, [isInitialized, setPaths])

  useEffect(() => {
    if (isInitialized) {
      setIsSaving(true)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentPaths))
        if (currentPaths.length > 0) {
          setLastSaved(new Date())
          addToHistory()
        } else {
          setLastSaved(null)
        }
        setTimeout(() => setIsSaving(false), 500)
      } catch (error) {
        console.error('Failed to save to localStorage:', error)
        toast.error('Failed to save data to localStorage')
        setIsSaving(false)
      }
    }
  }, [currentPaths, isInitialized])

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

  useEffect(() => {
    if (editingPathId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingPathId])

  useEffect(() => {
    const updateTimeDisplay = () => {
      setTimeDisplay(getTimeAgo(lastSaved))
    }
    
    updateTimeDisplay()
    const interval = setInterval(updateTimeDisplay, 10000)
    
    return () => clearInterval(interval)
  }, [lastSaved])

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

  const handleStartEditPathName = (pathId: string, currentName: string) => {
    setEditingPathId(pathId)
    setEditingPathName(currentName)
  }

  const handleSavePathName = () => {
    if (!editingPathId || !editingPathName.trim()) {
      setEditingPathId(null)
      setEditingPathName('')
      return
    }

    const newPaths = currentPaths.map(path =>
      path.id === editingPathId ? { ...path, name: editingPathName.trim() } : path
    )
    setPaths(newPaths)
    pushState(newPaths)
    toast.success(`Path renamed to "${editingPathName.trim()}"`)
    setEditingPathId(null)
    setEditingPathName('')
  }

  const handleCancelEditPathName = () => {
    setEditingPathId(null)
    setEditingPathName('')
  }

  const handleExportJSON = () => {
    const dataStr = JSON.stringify({ paths: currentPaths }, null, 2)
    setExportJSON(dataStr)
    setExportDialogOpen(true)
  }

  const handleDownloadJSON = () => {
    const dataBlob = new Blob([exportJSON], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `decision-trees-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Decision trees downloaded')
  }

  const handleCopyExportJSON = () => {
    navigator.clipboard.writeText(exportJSON)
    toast.success('JSON copied to clipboard')
  }

  const importPaths = (data: unknown) => {
    if (!data || typeof data !== 'object' || !('paths' in data) || !Array.isArray(data.paths)) {
      toast.error('Invalid JSON format: must contain a "paths" array')
      return false
    }

    const mergedPaths = [...currentPaths, ...data.paths]

    setPaths(mergedPaths)
    pushState(mergedPaths)
    toast.success(`Imported ${data.paths.length} decision tree(s)`)

    if (!selectedPathId && data.paths.length > 0) {
      setSelectedPathId(data.paths[0].id)
    }

    return true
  }

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content)

        importPaths(data)
      } catch (error) {
        toast.error('Failed to parse JSON file')
      }
    }
    reader.readAsText(file)
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const importJSONTrimmed = importJSON.trim()
  const parsedImportJSON = (() => {
    if (!importJSONTrimmed) {
      return { isValid: false, hasContent: false }
    }

    try {
      const parsed = JSON.parse(importJSONTrimmed)
      const hasPaths = !!parsed && typeof parsed === 'object' && 'paths' in parsed && Array.isArray(parsed.paths)

      return {
        isValid: hasPaths,
        hasContent: true,
      }
    } catch {
      return {
        isValid: false,
        hasContent: true,
      }
    }
  })()

  const handleSubmitImportJSON = () => {
    if (!parsedImportJSON.isValid) return

    try {
      const parsed = JSON.parse(importJSONTrimmed)
      if (importPaths(parsed)) {
        setImportJSON('')
        setImportDialogOpen(false)
      }
    } catch {
      toast.error('Failed to parse JSON')
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

  const getTimeAgo = (date: Date | null): string => {
    if (!date) return ''
    
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (seconds < 10) return 'just now'
    if (seconds < 60) return `${seconds}s ago`
    
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const formatFullTimestamp = (date: Date): string => {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

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

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Code className="text-primary" weight="duotone" />
              Export Decision Trees
            </DialogTitle>
            <DialogDescription>
              Copy the JSON or download it as a file to import into another instance.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            <pre className="bg-muted p-4 rounded-lg overflow-auto h-full text-sm font-mono max-h-[50vh]">
              <code>{exportJSON}</code>
            </pre>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCopyExportJSON}>
              <Copy />
              Copy to Clipboard
            </Button>
            <Button onClick={handleDownloadJSON}>
              <Download />
              Download JSON
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Upload className="text-primary" weight="duotone" />
              Submit Decision Tree JSON
            </DialogTitle>
            <DialogDescription>
              Paste exported JSON below. The submit button is only enabled for valid JSON containing a top-level paths array.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden space-y-2">
            <Textarea
              value={importJSON}
              onChange={(e) => setImportJSON(e.target.value)}
              placeholder={'{\n  "paths": []\n}'}
              aria-invalid={parsedImportJSON.hasContent && !parsedImportJSON.isValid}
              className={`h-[50vh] overflow-y-auto resize-none font-mono text-sm ${parsedImportJSON.hasContent && !parsedImportJSON.isValid ? 'border-destructive focus-visible:ring-destructive/20' : ''}`}
            />
            {parsedImportJSON.hasContent && !parsedImportJSON.isValid && (
              <p className="text-sm text-destructive">
                Enter valid JSON with a top-level paths array before submitting.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitImportJSON} disabled={!parsedImportJSON.hasContent || !parsedImportJSON.isValid}>
              Submit JSON
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <ClockCounterClockwise className="text-primary" weight="duotone" />
              Save History
            </DialogTitle>
            <DialogDescription>
              View all previous saves with timestamps and details
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 max-h-[500px]">
            {saveHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ClockCounterClockwise size={48} className="text-muted-foreground mb-3" weight="duotone" />
                <p className="text-muted-foreground">No save history yet</p>
                <p className="text-sm text-muted-foreground mt-1">History will appear as you make changes</p>
              </div>
            ) : (
              <div className="space-y-2 pr-4">
                {saveHistory.map((entry, index) => {
                  const isRecent = index === 0
                  const date = entry.timestamp
                  const timeStr = date.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit'
                  })
                  const dateStr = date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  })
                  
                  return (
                    <div
                      key={entry.id}
                      className={`p-4 rounded-lg border-2 ${
                        isRecent 
                          ? 'bg-accent/10 border-accent' 
                          : 'bg-card border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-foreground">
                              {timeStr}
                            </span>
                            {isRecent && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">
                                Latest
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mb-2">
                            {dateStr}
                          </div>
                          <div className="flex gap-4 text-sm">
                            <div className="flex items-center gap-1.5">
                              <Tree size={14} className="text-primary" />
                              <span className="text-muted-foreground">
                                {entry.pathCount} {entry.pathCount === 1 ? 'path' : 'paths'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <DiamondsFour size={14} className="text-primary" />
                              <span className="text-muted-foreground">
                                {entry.totalNodes} {entry.totalNodes === 1 ? 'node' : 'nodes'}
                              </span>
                            </div>
                          </div>
                          {entry.action && (
                            <div className="mt-2 text-xs text-muted-foreground italic">
                              {entry.action}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      <div className="container mx-auto p-6 max-w-7xl">
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold text-primary">Decision Tree Visualizer</h1>
                {isInitialized && currentPaths.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 text-sm px-3 py-1 rounded-full bg-muted border border-border">
                      {isSaving ? (
                        <>
                          <Clock className="text-accent animate-pulse" size={16} />
                          <span className="text-muted-foreground">Saving...</span>
                        </>
                      ) : lastSaved ? (
                        <>
                          <CheckCircleIcon className="text-accent" size={16} weight="fill" />
                          <span className="text-muted-foreground">Saved {timeDisplay}</span>
                        </>
                      ) : null}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryDialogOpen(true)}
                      title="View Save History"
                    >
                      <ClockCounterClockwise />
                      History
                    </Button>
                  </div>
                )}
              </div>
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    title="Import JSON"
                  >
                    <Upload />
                    Import
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    <Upload className="mr-2" />
                    Upload JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
                    <Code className="mr-2" />
                    Submit JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                      className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${
                        selectedPathId === path.id
                          ? 'bg-primary/10 border-primary'
                          : 'bg-card border-border hover:bg-muted'
                      } ${editingPathId === path.id ? '' : 'cursor-pointer'}`}
                      onClick={() => editingPathId !== path.id && setSelectedPathId(path.id)}
                    >
                      <div className="flex-1 min-w-0">
                        {editingPathId === path.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              ref={editInputRef}
                              value={editingPathName}
                              onChange={(e) => setEditingPathName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSavePathName()
                                } else if (e.key === 'Escape') {
                                  handleCancelEditPathName()
                                }
                              }}
                              className="h-8 text-sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSavePathName()
                              }}
                              className="h-8 w-8 p-0 text-accent hover:text-accent"
                            >
                              <Check />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCancelEditPathName()
                              }}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            >
                              <X />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="font-medium truncate">{path.name}</div>
                            <div className="text-xs text-muted-foreground font-mono truncate">
                              {path.id}
                            </div>
                          </>
                        )}
                      </div>
                      {editingPathId !== path.id && (
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStartEditPathName(path.id, path.name)
                            }}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            title="Rename path"
                          >
                            <PencilSimple />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeletePath(path.id)
                            }}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            title="Delete path"
                          >
                            <Trash />
                          </Button>
                        </div>
                      )}
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
                                      <div className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: 'oklch(0.72 0.15 195)' }}>
                                        <DiamondsFour weight="fill" size={20} style={{ color: 'oklch(0.98 0 0)' }} />
                                      </div>
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">Decision</div>
                                        <div className="text-xs text-muted-foreground">A decision point that branches based on multiple conditions. Each condition evaluates to true or false and directs the flow accordingly.</div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex gap-3">
                                      <div className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: 'oklch(0.88 0.08 210)' }}>
                                        <CheckCircle weight="fill" size={20} style={{ color: 'oklch(0.25 0.05 210)' }} />
                                      </div>
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">Condition</div>
                                        <div className="text-xs text-muted-foreground">A specific condition or criteria that must be evaluated. Conditions are attached to decision nodes and represent different possible paths.</div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex gap-3">
                                      <div className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: 'oklch(0.75 0.12 160)' }}>
                                        <CheckCircle weight="fill" size={20} style={{ color: 'oklch(0.98 0 0)' }} />
                                      </div>
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">Outcome</div>
                                        <div className="text-xs text-muted-foreground">A final result or action that ends a decision path. Outcomes represent the conclusion of a logical flow and do not branch further.</div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex gap-3">
                                      <div className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: 'oklch(0.68 0.18 280)' }}>
                                        <FlowArrow weight="fill" size={20} style={{ color: 'oklch(0.98 0 0)' }} />
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