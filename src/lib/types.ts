export type NodeType = 'decision' | 'outcome' | 'path-reference' | 'condition'

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

export interface ConditionNode {
  id: string
  type: 'condition'
  label: string
  node: TreeNode | null
}

export type TreeNode = DecisionNode | OutcomeNode | PathReferenceNode | ConditionNode

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
