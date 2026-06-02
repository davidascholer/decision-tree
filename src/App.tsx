import { useKV } from '@github/spark/hooks'
import { DecisionPath, TreeNode } from './lib/types'
import { generateId } from './lib/tree-utils'
import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { Input } from './components/ui/input'
import { Plus, Trash, List, Tree } from '@phosphor-icons/react'
import { useState } from 'react'
import { TreeNodeEditor } from './components/TreeNodeEditor'
import { Flowchart } from './components/Flowchart'
import { toast } from 'sonner'
import { Toaster } from './components/ui/sonner'

function App() {
  const [paths, setPaths] = useKV<DecisionPath[]>('decision-paths', [])
  const [selectedPathId, setSelectedPathId] = useState<string | undefined>(undefined)
  const [newPathName, setNewPathName] = useState('')
  const [showNewPathInput, setShowNewPathInput] = useState(false)

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

  const selectedPath = selectedPathId ? currentPaths.find(p => p.id === selectedPathId) : undefined

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <div className="container mx-auto p-6 max-w-7xl">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">Decision Tree Visualizer</h1>
          <p className="text-muted-foreground text-lg">
            Create and visualize complex decision logic with flowchart-style diagrams
          </p>
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
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="editor" className="flex items-center gap-2">
                      <List />
                      <span>Editor</span>
                    </TabsTrigger>
                    <TabsTrigger value="flowchart" className="flex items-center gap-2">
                      <Tree />
                      <span>Flowchart</span>
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