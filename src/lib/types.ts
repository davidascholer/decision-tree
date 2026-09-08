export type NodeType =
  | "decision"
  | "outcome"
  | "path-reference"
  | "condition"
  | "condition-loop";
export type OutcomeStatus = "success" | "fail" | "neutral";

export interface DecisionNode {
  id: string;
  type: "decision";
  description: string;
  conditions?: ConditionNode[];
  note?: string;
}

export interface ConditionLoopNode {
  id: string;
  type: "condition-loop";
  description: string;
  conditions?: ConditionNode[];
  continueNode?: TreeNode;
  note?: string;
}

export interface OutcomeNode {
  id: string;
  type: "outcome";
  description: string;
  note?: string;
  outcomeType?: OutcomeStatus;
}

export interface PathReferenceNode {
  id: string;
  type: "path-reference";
  pathId: string;
  note?: string;
}

export interface ConditionNode {
  id: string;
  type: "condition";
  description: string;
  next?: TreeNode;
  note?: string;
}

export type TreeNode =
  | DecisionNode
  | ConditionLoopNode
  | OutcomeNode
  | PathReferenceNode
  | ConditionNode;

export type DecisionPath = (
  | DecisionNode
  | ConditionLoopNode
  | OutcomeNode
  | PathReferenceNode
) & {
  name: string;
  pathNote?: string;
};

export interface DecisionProject {
  id: string;
  kind: "project";
  label: string;
  paths: DecisionPath[];
}

export interface DecisionTreeData {
  paths: DecisionPath[];
}

export interface SaveHistoryEntry {
  id: string;
  timestamp: Date;
  pathCount: number;
  totalNodes: number;
  action?: string;
}
