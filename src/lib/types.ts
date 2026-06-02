export type NodeType = 'decision' | 'outcome' | 'path-reference' | 'condition'

export interface DecisionNode {
  id: string
  type: 'decision'
  description: string
  conditions?: ConditionNode[]
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
  description: string
  next?: TreeNode
}

export type TreeNode = DecisionNode | OutcomeNode | PathReferenceNode | ConditionNode

export type DecisionPath = (DecisionNode | OutcomeNode | PathReferenceNode) & {
  name: string
}

export interface DecisionTreeData {
  paths: DecisionPath[]
}
