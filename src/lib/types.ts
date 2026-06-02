export type NodeType = 'decision' | 'outcome' | 'path-reference'

export interface DecisionNode {
  id: string
  type: 'decision'
  question: string
  branches: Branch[]
}

export interface OutcomeNode {
  id: string
  type: 'outcome'
  description: string
}

export interface PathReferenceNode {
  id: string
  type: 'path-reference'
  pathId: string
}

export type TreeNode = DecisionNode | OutcomeNode | PathReferenceNode

export interface Branch {
  id: string
  label: string
  node: TreeNode
}

export interface DecisionPath {
  id: string
  name: string
  node: TreeNode
}

export interface DecisionTreeData {
  paths: DecisionPath[]
}
