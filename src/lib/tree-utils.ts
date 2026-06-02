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

export function createExamplePaths(): DecisionPath[] {
  const targetPathId = generateId()
  const mainPathId = generateId()
  
  const targetPath: DecisionPath = {
    id: targetPathId,
    name: 'Final Destination Path',
    node: {
      id: generateId(),
      type: 'decision',
      question: 'Final verification step',
      branches: [
        {
          id: generateId(),
          label: 'Verified',
          node: {
            id: generateId(),
            type: 'outcome',
            description: 'Process completed successfully!'
          }
        },
        {
          id: generateId(),
          label: 'Failed',
          node: {
            id: generateId(),
            type: 'outcome',
            description: 'Verification failed - review required'
          }
        }
      ]
    }
  }
  
  const mainPath: DecisionPath = {
    id: mainPathId,
    name: 'Complex Decision Example',
    node: {
      id: generateId(),
      type: 'decision',
      question: 'Is the user authenticated?',
      branches: [
        {
          id: generateId(),
          label: 'Yes',
          node: {
            id: generateId(),
            type: 'decision',
            question: 'Does the user have admin privileges?',
            branches: [
              {
                id: generateId(),
                label: 'Yes',
                node: {
                  id: generateId(),
                  type: 'decision',
                  question: 'Is the action high-risk?',
                  branches: [
                    {
                      id: generateId(),
                      label: 'Yes',
                      node: {
                        id: generateId(),
                        type: 'decision',
                        question: 'Has two-factor authentication been completed?',
                        branches: [
                          {
                            id: generateId(),
                            label: 'Yes',
                            node: {
                              id: generateId(),
                              type: 'path-reference',
                              pathId: targetPathId
                            }
                          },
                          {
                            id: generateId(),
                            label: 'No',
                            node: {
                              id: generateId(),
                              type: 'outcome',
                              description: 'Request 2FA authentication'
                            }
                          }
                        ]
                      }
                    },
                    {
                      id: generateId(),
                      label: 'No',
                      node: {
                        id: generateId(),
                        type: 'outcome',
                        description: 'Action approved - proceed'
                      }
                    }
                  ]
                }
              },
              {
                id: generateId(),
                label: 'No',
                node: {
                  id: generateId(),
                  type: 'outcome',
                  description: 'Access denied - insufficient privileges'
                }
              }
            ]
          }
        },
        {
          id: generateId(),
          label: 'No',
          node: {
            id: generateId(),
            type: 'outcome',
            description: 'Redirect to login page'
          }
        }
      ]
    }
  }
  
  return [targetPath, mainPath]
}

export function generateTextRepresentation(
  node: TreeNode,
  paths: DecisionPath[],
  indent: number = 0,
  prefix: string = '',
  visitedPaths: Set<string> = new Set()
): string {
  const indentStr = '  '.repeat(indent)
  const lines: string[] = []

  if (node.type === 'decision') {
    lines.push(`${indentStr}${prefix}${node.question}`)
    node.branches.forEach((branch, index) => {
      const isLast = index === node.branches.length - 1
      const branchPrefix = isLast ? '└─ ' : '├─ '
      const childPrefix = isLast ? '   ' : '│  '
      
      lines.push(`${indentStr}${branchPrefix}[${branch.label}]`)
      lines.push(
        generateTextRepresentation(
          branch.node,
          paths,
          indent + 1,
          childPrefix,
          visitedPaths
        )
      )
    })
  } else if (node.type === 'outcome') {
    lines.push(`${indentStr}${prefix}✓ ${node.description}`)
  } else if (node.type === 'path-reference') {
    const referencedPath = paths.find(p => p.id === node.pathId)
    if (referencedPath) {
      if (visitedPaths.has(node.pathId)) {
        lines.push(`${indentStr}${prefix}↻ Path: ${referencedPath.name} (circular reference)`)
      } else {
        lines.push(`${indentStr}${prefix}→ Path: ${referencedPath.name}`)
        visitedPaths.add(node.pathId)
        lines.push(
          generateTextRepresentation(
            referencedPath.node,
            paths,
            indent + 1,
            '  ',
            visitedPaths
          )
        )
      }
    } else {
      lines.push(`${indentStr}${prefix}→ Path: [Not Found]`)
    }
  }

  return lines.join('\n')
}
