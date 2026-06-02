export type NodeType = 'decision' | 'outcome' | 'path-reference' | 'condition'

export interface DecisionNode {
  id: string
  type: 'decision'
  question: string
  condition?: ConditionNode
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
  next?: TreeNode
}

export type TreeNode = DecisionNode | OutcomeNode | PathReferenceNode | ConditionNode

export interface DecisionPath {
  id: string
  name: string
  type: NodeType
  question?: string
  condition?: ConditionNode
  description?: string
  pathId?: string
  label?: string
  next?: TreeNode
}

export interface DecisionTreeData {
  paths: DecisionPath[]
}
