import { useKV } from '@github/spark/hooks'
import { DecisionPath, TreeNode } from './lib/types'
import { generateId } from './lib/tree-utils'
import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { Input } from './components/ui/input'
import { Plus, Trash, List, Tree, Download, Upload, Palette, Code, Copy } from '@phosphor-icons/react'
import { useState, useRef } from 'react'
import { TreeNodeEditor } from './components/TreeNodeEditor'
import { Flowchart } from './components/Flowchart'
import { ColorSettings } from './components/ColorSettings'
import { toast } from 'sonner'
import { Toaster } from './components/ui/sonner'

function App() {
  const [paths, setPaths] = useKV<DecisionPath[]>('decision-paths', [])
  const [selectedPathId, setSelectedPathId] = useState<string | undefined>(undefined)
  const [newPathName, setNewPathName] = useState('')
  const [showNewPathInput, setShowNewPathInput] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentPaths = paths || []

  const handleAddPath = () => {
    if (!newPathName.trim()) return

    const newPath: DecisionPath = {
      id: generateId(),
      name: newPathName.trim(),
      node: {
        id: generateId(),
        type: 'decision',
        question: 'Start',
        branches: []
      }
    }

    setPaths((current) => [...(current || []), newPath])
    setSelectedPathId(newPath.id)
    setNewPathName('')
    setShowNewPathInput(false)
    toast.success(`Path "${newPath.name}" created`)
  }

  const handleDeletePath = (pathId: string) => {
    const path = currentPaths.find(p => p.id === pathId)
    setPaths((current) => (current || []).filter(p => p.id !== pathId))
    if (selectedPathId === pathId) {
      setSelectedPathId(undefined)
    }
    toast.success(`Path "${path?.name}" deleted`)
  }

  const handleUpdatePath = (pathId: string, updatedNode: TreeNode) => {
    setPaths((current) =>
      (current || []).map(path =>
        path.id === pathId
          ? { ...path, node: updatedNode }
          : path
      )
    )
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
                    <TabsTrigger value="json" className="flex items-center gap-2">
                      <Code />
                      <span>JSON</span>
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="flex items-center gap-2">
                      <Palette />
                      <span>Settings</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="editor">
                    <Card>
                      <CardHeader>
                        <CardTitle>{selectedPath.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <TreeNodeEditor
                          node={selectedPath.node}
                          paths={currentPaths}
                          currentPathId={selectedPath.id}
                          onUpdateNode={(updatedNode) =>
                            handleUpdatePath(selectedPath.id, updatedNode)
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

                  <TabsContent value="settings">
                    <ColorSettings />
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