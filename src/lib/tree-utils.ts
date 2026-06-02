import { DecisionPath, TreeNode, DecisionNode, Branch } from './types'

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function findNodeById(node: TreeNode, id: string): TreeNode | null {
  if (node.id === id) return node
  
  if (node.type === 'decision') {
    for (const branch of node.branches) {
      const found = findNodeById(branch.node, id)
      if (found) return found
    }
  }
  
  return null
}

export function findNodeInPaths(paths: DecisionPath[], nodeId: string): TreeNode | null {
  for (const path of paths) {
    const found = findNodeById(path.node, nodeId)
    if (found) return found
  }
  return null
}

export function hasCircularReference(
  paths: DecisionPath[],
  currentPathId: string,
  targetPathId: string
): boolean {
  if (currentPathId === targetPathId) return true
  
  const targetPath = paths.find(p => p.id === targetPathId)
  if (!targetPath) return false
  
  const visited = new Set<string>()
  
  function checkNode(node: TreeNode): boolean {
    if (node.type === 'path-reference') {
      if (node.pathId === currentPathId) return true
      if (visited.has(node.pathId)) return false
      
      visited.add(node.pathId)
      const referencedPath = paths.find(p => p.id === node.pathId)
      if (referencedPath) {
        return checkNode(referencedPath.node)
      }
    } else if (node.type === 'decision') {
      for (const branch of node.branches) {
        if (checkNode(branch.node)) return true
      }
    }
    return false
  }
  
  return checkNode(targetPath.node)
}

export function updateNodeInTree(node: TreeNode, id: string, updater: (node: TreeNode) => TreeNode): TreeNode {
  if (node.id === id) {
    return updater(node)
  }
  
  if (node.type === 'decision') {
    return {
      ...node,
      branches: node.branches.map(branch => ({
        ...branch,
        node: updateNodeInTree(branch.node, id, updater)
      }))
    }
  }
  
  return node
}

export function deleteNodeFromTree(node: TreeNode, branchId: string): TreeNode | null {
  if (node.type === 'decision') {
    const branchIndex = node.branches.findIndex(b => b.id === branchId)
    if (branchIndex !== -1) {
      const newBranches = node.branches.filter((_, i) => i !== branchIndex)
      return {
        ...node,
        branches: newBranches
      }
    }
    
    return {
      ...node,
      branches: node.branches.map(branch => ({
        ...branch,
        node: deleteNodeFromTree(branch.node, branchId) || branch.node
      })).filter(branch => branch.node !== null)
    }
  }
  
  return node
}
