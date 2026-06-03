import { DecisionPath, TreeNode, DecisionNode, ConditionNode } from './types'

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function findNodeById(node: TreeNode | DecisionPath, id: string): TreeNode | DecisionPath | null {
  if (node.id === id) return node
  
  if (node.type === 'decision' && node.conditions) {
    for (const condition of node.conditions) {
      const found = findNodeById(condition, id)
      if (found) return found
    }
  }
  
  if (node.type === 'condition' && node.next) {
    const found = findNodeById(node.next, id)
    if (found) return found
  }
  
  return null
}

export function findNodeInPaths(paths: DecisionPath[], nodeId: string): TreeNode | DecisionPath | null {
  for (const path of paths) {
    const found = findNodeById(path, nodeId)
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
  
  function checkNode(node: TreeNode | DecisionPath): boolean {
    if (node.type === 'path-reference') {
      if (node.pathId === currentPathId) return true
      if (visited.has(node.pathId)) return false
      
      visited.add(node.pathId)
      const referencedPath = paths.find(p => p.id === node.pathId)
      if (referencedPath) {
        return checkNode(referencedPath)
      }
    } else if (node.type === 'decision' && node.conditions) {
      return node.conditions.some(condition => checkNode(condition))
    } else if (node.type === 'condition' && node.next) {
      return checkNode(node.next)
    }
    return false
  }
  
  return checkNode(targetPath)
}

export function updateNodeInTree(node: TreeNode | DecisionPath, id: string, updater: (node: TreeNode | DecisionPath) => TreeNode | DecisionPath): TreeNode | DecisionPath {
  if (node.id === id) {
    return updater(node)
  }
  
  if (node.type === 'decision' && node.conditions) {
    return {
      ...node,
      conditions: node.conditions.map(condition =>
        updateNodeInTree(condition, id, updater) as ConditionNode
      )
    }
  }
  
  if (node.type === 'condition' && node.next) {
    return {
      ...node,
      next: updateNodeInTree(node.next, id, updater) as TreeNode
    }
  }
  
  return node
}

export function deleteConditionFromDecision(node: DecisionNode): DecisionNode {
  return {
    ...node,
    conditions: undefined
  }
}

export function createExamplePaths(): DecisionPath[] {
  const approvalPathId = generateId()
  const requestProcessingId = generateId()
  const routingLogicId = generateId()
  
  const approvalPath: DecisionPath = {
    id: approvalPathId,
    name: 'Approval Workflow',
    type: 'decision',
    description: 'Does request require manager approval?',
    conditions: [{
      id: generateId(),
      type: 'condition',
      description: 'Yes',
      next: {
        id: generateId(),
        type: 'decision',
        description: 'Is manager available?',
        conditions: [{
          id: generateId(),
          type: 'condition',
          description: 'Available',
          next: {
            id: generateId(),
            type: 'outcome',
            description: 'Request approved and forwarded to fulfillment team'
          }
        }]
      }
    }]
  }
  
  const requestProcessing: DecisionPath = {
    id: requestProcessingId,
    name: 'Request Processing',
    type: 'decision',
    description: 'Is the customer account in good standing?',
    conditions: [{
      id: generateId(),
      type: 'condition',
      description: 'Active',
      next: {
        id: generateId(),
        type: 'decision',
        description: 'Does customer have sufficient credit limit?',
        conditions: [{
          id: generateId(),
          type: 'condition',
          description: 'Verified',
          next: {
            id: generateId(),
            type: 'decision',
            description: 'Does order exceed standard limits?',
            conditions: [{
              id: generateId(),
              type: 'condition',
              description: 'Standard',
              next: {
                id: generateId(),
                type: 'path-reference',
                pathId: approvalPathId
              }
            }]
          }
        }]
      }
    }]
  }
  
  const routingLogic: DecisionPath = {
    id: routingLogicId,
    name: 'Order Routing Logic',
    type: 'decision',
    description: 'Is order urgent?',
    conditions: [{
      id: generateId(),
      type: 'condition',
      description: 'Express',
      next: {
        id: generateId(),
        type: 'decision',
        description: 'Is express shipping available in customer region?',
        conditions: [{
          id: generateId(),
          type: 'condition',
          description: 'Available',
          next: {
            id: generateId(),
            type: 'decision',
            description: 'Does customer accept express shipping surcharge?',
            conditions: [{
              id: generateId(),
              type: 'condition',
              description: 'Confirmed',
              next: {
                id: generateId(),
                type: 'decision',
                description: 'Is warehouse operational?',
                conditions: [{
                  id: generateId(),
                  type: 'condition',
                  description: 'Operational',
                  next: {
                    id: generateId(),
                    type: 'outcome',
                    description: 'Route to express fulfillment center with 24h SLA'
                  }
                }]
              }
            }]
          }
        }]
      }
    }]
  }
  
  return [approvalPath, requestProcessing, routingLogic]
}

export function isPathReferencedByOthers(pathId: string, paths: DecisionPath[]): { isReferenced: boolean; referencedBy: string[] } {
  const referencedBy: string[] = []
  
  function checkNode(node: TreeNode | DecisionPath): boolean {
    if (node.type === 'path-reference' && node.pathId === pathId) {
      return true
    }
    
    if (node.type === 'decision' && node.conditions) {
      return node.conditions.some(condition => checkNode(condition))
    }
    
    if (node.type === 'condition' && node.next) {
      return checkNode(node.next)
    }
    
    return false
  }
  
  for (const path of paths) {
    if (path.id !== pathId && checkNode(path)) {
      referencedBy.push(path.name)
    }
  }
  
  return {
    isReferenced: referencedBy.length > 0,
    referencedBy
  }
}

export function generateTextRepresentation(
  node: TreeNode | DecisionPath,
  paths: DecisionPath[],
  indent: number = 0,
  prefix: string = '',
  visitedPaths: Set<string> = new Set()
): string {
  const indentStr = '  '.repeat(indent)
  const lines: string[] = []

  if (node.type === 'decision') {
    lines.push(`${indentStr}${prefix}${node.description}`)
    if (node.conditions && node.conditions.length > 0) {
      node.conditions.forEach((condition, index) => {
        lines.push(
          generateTextRepresentation(
            condition,
            paths,
            indent,
            prefix,
            visitedPaths
          )
        )
      })
    }
  } else if (node.type === 'condition') {
    lines.push(`${indentStr}${prefix}└─ [${node.description}]`)
    if (node.next) {
      lines.push(
        generateTextRepresentation(
          node.next,
          paths,
          indent + 1,
          '   ',
          visitedPaths
        )
      )
    }
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
            referencedPath,
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

export function collectNotedNodes(root: TreeNode | DecisionPath): { id: string; note: string }[] {
  const result: { id: string; note: string }[] = []

  function traverse(n: TreeNode | DecisionPath) {
    if ('note' in n && n.note && n.note.trim()) {
      result.push({ id: n.id, note: n.note.trim() })
    }
    if (n.type === 'decision' && n.conditions) {
      for (const condition of n.conditions) {
        traverse(condition)
      }
    }
    if (n.type === 'condition' && n.next) {
      traverse(n.next)
    }
  }

  traverse(root)
  return result
}

export function findIncompleteConditions(node: TreeNode | DecisionPath): string[] {
  const incompleteIds: string[] = []

  function checkNode(n: TreeNode | DecisionPath) {
    if (n.type === 'condition') {
      if (!n.next) {
        incompleteIds.push(n.id)
      } else {
        checkNode(n.next)
      }
    } else if (n.type === 'decision') {
      if (n.conditions && n.conditions.length > 0) {
        n.conditions.forEach(condition => checkNode(condition))
      }
    }
  }

  checkNode(node)
  return incompleteIds
}
