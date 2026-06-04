import { TreeNode, DecisionPath, OutcomeNode } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Trash,
  Pencil,
  DiamondsFour,
  CheckCircle,
  FlowArrow,
  CaretDown,
  CaretRight,
  WarningCircle,
  NotePencil,
  DotsSixVertical,
  GitBranch,
} from "@phosphor-icons/react";
import { useState, useMemo, useEffect } from "react";
import { AddNodeDialog } from "./AddNodeDialog";
import {
  generateId,
  findIncompleteConditions,
  collectNotedNodes,
} from "@/lib/tree-utils";
import { useNodeColors } from "@/hooks/use-node-colors";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type DecisionLikeNode = DecisionPath | Extract<TreeNode, { type: "decision" }>;
type ConditionNode = Extract<TreeNode, { type: "condition" }>;

interface DraggedBranch {
  sourceDecisionId: string;
  sourceConditionId: string;
}

interface SwapDescriptionResult {
  updated: DecisionLikeNode;
  swappedDescription?: string;
}

const getAccordionContentClassName = (isExpanded: boolean) =>
  `grid overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0 mt-0 pointer-events-none"}`;

const getDropTargetClassName = (isActive: boolean) =>
  isActive ? "ring-2 ring-emerald-500/80 bg-emerald-500/10" : "";

const hasDescendantBranches = (condition: ConditionNode): boolean => {
  const next = condition.next;
  if (!next || next.type !== "decision") {
    return false;
  }

  if ((next.conditions || []).length > 0) {
    return true;
  }

  return false;
};

const containsDecisionId = (
  node: TreeNode | undefined,
  decisionId: string,
): boolean => {
  if (!node) return false;
  if (node.type === "decision") {
    if (node.id === decisionId) return true;
    return (node.conditions || []).some((condition) =>
      containsDecisionId(condition.next, decisionId),
    );
  }
  if (node.type === "condition") {
    return containsDecisionId(node.next, decisionId);
  }
  return false;
};

const removeConditionBranch = (
  node: DecisionLikeNode,
  decisionId: string,
  conditionId: string,
): { updated: DecisionLikeNode; removed: ConditionNode | null } => {
  if (node.type === "decision") {
    if (node.id === decisionId) {
      const conditions = node.conditions || [];
      const removed =
        conditions.find((condition) => condition.id === conditionId) || null;
      if (!removed) {
        return { updated: node, removed: null };
      }
      return {
        updated: {
          ...node,
          conditions: conditions.filter(
            (condition) => condition.id !== conditionId,
          ),
        },
        removed,
      };
    }

    let removed: ConditionNode | null = null;
    const updatedConditions = (node.conditions || []).map((condition) => {
      if (!condition.next || removed) return condition;
      if (condition.next.type !== "decision") return condition;

      const result = removeConditionBranch(
        condition.next,
        decisionId,
        conditionId,
      );
      if (result.removed) {
        removed = result.removed;
        return {
          ...condition,
          next: result.updated as Extract<TreeNode, { type: "decision" }>,
        };
      }

      return condition;
    });

    return {
      updated: {
        ...node,
        conditions: updatedConditions,
      },
      removed,
    };
  }

  return { updated: node, removed: null };
};

const addConditionBranchToDecision = (
  node: DecisionLikeNode,
  targetDecisionId: string,
  branch: ConditionNode,
): { updated: DecisionLikeNode; inserted: boolean } => {
  if (node.type !== "decision") {
    return { updated: node, inserted: false };
  }

  if (node.id === targetDecisionId) {
    return {
      updated: {
        ...node,
        conditions: [...(node.conditions || []), branch],
      },
      inserted: true,
    };
  }

  let inserted = false;
  const updatedConditions = (node.conditions || []).map((condition) => {
    if (!condition.next || inserted) return condition;
    if (condition.next.type !== "decision") return condition;

    const result = addConditionBranchToDecision(
      condition.next,
      targetDecisionId,
      branch,
    );
    if (!result.inserted) return condition;

    inserted = true;
    return {
      ...condition,
      next: result.updated as Extract<TreeNode, { type: "decision" }>,
    };
  });

  return {
    updated: {
      ...node,
      conditions: updatedConditions,
    },
    inserted,
  };
};

const findConditionBranch = (
  node: DecisionLikeNode,
  decisionId: string,
  conditionId: string,
): ConditionNode | null => {
  if (node.type !== "decision") {
    return null;
  }

  if (node.id === decisionId) {
    return (
      (node.conditions || []).find(
        (condition) => condition.id === conditionId,
      ) || null
    );
  }

  for (const condition of node.conditions || []) {
    if (!condition.next || condition.next.type !== "decision") continue;
    const nestedMatch = findConditionBranch(
      condition.next,
      decisionId,
      conditionId,
    );
    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
};

const swapRootDescriptionIntoTarget = (
  node: DecisionLikeNode,
  targetDecisionId: string,
  rootDescription: string,
): SwapDescriptionResult => {
  if (node.type !== "decision") {
    return { updated: node };
  }

  if (node.id === targetDecisionId) {
    return {
      updated: {
        ...node,
        description: rootDescription,
      },
      swappedDescription: node.description,
    };
  }

  let swappedDescription: string | undefined;
  const updatedConditions = (node.conditions || []).map((condition) => {
    if (!condition.next || swappedDescription) return condition;
    if (condition.next.type !== "decision") return condition;

    const result = swapRootDescriptionIntoTarget(
      condition.next,
      targetDecisionId,
      rootDescription,
    );
    if (!result.swappedDescription) return condition;

    swappedDescription = result.swappedDescription;
    return {
      ...condition,
      next: result.updated as Extract<TreeNode, { type: "decision" }>,
    };
  });

  return {
    updated: {
      ...node,
      conditions: updatedConditions,
    },
    swappedDescription,
  };
};

interface TreeNodeEditorProps {
  path: DecisionPath;
  paths: DecisionPath[];
  currentPathId: string;
  onUpdatePath: (path: DecisionPath) => void;
  depth?: number;
  onDeleteNode?: () => void;
}

export function TreeNodeEditor({
  path,
  paths,
  currentPathId,
  onUpdatePath,
  depth = 0,
  onDeleteNode,
}: TreeNodeEditorProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingConditionId, setEditingConditionId] = useState<string | null>(
    null,
  );
  const [isExpanded, setIsExpanded] = useState(true);
  const [draggedBranch, setDraggedBranch] = useState<DraggedBranch | null>(
    null,
  );
  const [isRootDragging, setIsRootDragging] = useState(false);
  const [dragOverDecisionId, setDragOverDecisionId] = useState<string | null>(
    null,
  );
  const [deleteBranchDialogOpen, setDeleteBranchDialogOpen] = useState(false);
  const [branchToDeleteId, setBranchToDeleteId] = useState<string | null>(null);
  const [pathNoteDraft, setPathNoteDraft] = useState(path.pathNote || "");
  const colors = useNodeColors();

  useEffect(() => {
    setPathNoteDraft(path.pathNote || "");
  }, [path.id, path.pathNote]);

  const getOutcomeColors = (node: OutcomeNode) => {
    switch (node.outcomeType || "neutral") {
      case "success":
        return { bg: colors.outcome, fg: colors.outcomeForeground };
      case "fail":
        return { bg: "oklch(0.62 0.20 25)", fg: "oklch(0.98 0 0)" };
      case "neutral":
      default:
        return { bg: "oklch(0.58 0.10 235)", fg: "oklch(0.98 0 0)" };
    }
  };

  const citationMap = useMemo(() => {
    const noted = collectNotedNodes(path);
    const map = new Map<string, number>();
    noted.forEach((item, i) => map.set(item.id, i + 1));
    return map;
  }, [path]);

  const notedNodes = useMemo(() => collectNotedNodes(path), [path]);

  const incompleteConditionIds = useMemo(() => {
    return new Set(findIncompleteConditions(path));
  }, [path]);

  const hasChildren = (node: DecisionPath | TreeNode): boolean => {
    if (node.type === "decision") {
      return (node.conditions && node.conditions.length > 0) || false;
    }
    if (node.type === "condition") {
      return !!node.next;
    }
    return false;
  };

  const handleDelete = () => {
    if (hasChildren(path)) {
      toast.error(
        "Cannot delete node with children. Delete all child nodes first.",
      );
      return;
    }
    if (onDeleteNode) {
      onDeleteNode();
    }
  };

  const handleAddCondition = (
    _: string,
    nextNode: TreeNode,
    conditionDescription?: string,
  ) => {
    if (path.type === "decision") {
      const conditions = path.conditions || [];
      const description = (conditionDescription || "").trim();
      if (!description) {
        toast.error("Condition label is required");
        return;
      }
      onUpdatePath({
        ...path,
        conditions: [
          ...conditions,
          {
            id: generateId(),
            type: "condition",
            description,
            next: nextNode,
          },
        ],
      });
    }
  };

  const handleUpdatePath = (updates: Partial<DecisionPath>) => {
    onUpdatePath({ ...path, ...updates } as DecisionPath);
  };

  const deleteCondition = (conditionId: string) => {
    if (path.type === "decision") {
      const conditions = path.conditions || [];

      onUpdatePath({
        ...path,
        conditions: conditions.filter((c) => c.id !== conditionId),
      });
      toast.success("Branch deleted");
    }
  };

  const requestDeleteCondition = (condition: ConditionNode) => {
    if (!hasDescendantBranches(condition)) {
      deleteCondition(condition.id);
      return;
    }

    setBranchToDeleteId(condition.id);
    setDeleteBranchDialogOpen(true);
  };

  const confirmDeleteCondition = () => {
    if (branchToDeleteId) {
      deleteCondition(branchToDeleteId);
    }
    setDeleteBranchDialogOpen(false);
    setBranchToDeleteId(null);
  };

  const cancelDeleteCondition = () => {
    setDeleteBranchDialogOpen(false);
    setBranchToDeleteId(null);
  };

  const handleUpdateCondition = (
    conditionId: string,
    updatedCondition: any,
  ) => {
    if (path.type === "decision") {
      const conditions = path.conditions || [];
      onUpdatePath({
        ...path,
        conditions: conditions.map((c) =>
          c.id === conditionId ? updatedCondition : c,
        ),
      });
    }
  };

  const handleBranchDragStart = (
    sourceDecisionId: string,
    sourceConditionId: string,
  ) => {
    setDraggedBranch({ sourceDecisionId, sourceConditionId });
  };

  const handleBranchDragEnd = () => {
    setDraggedBranch(null);
    setDragOverDecisionId(null);
  };

  const handleRootDragStart = () => {
    setIsRootDragging(true);
    setDraggedBranch(null);
    setDragOverDecisionId(null);
    toast.info("Moving the root will switch descriptions only");
  };

  const handleRootDragEnd = () => {
    setIsRootDragging(false);
    setDragOverDecisionId(null);
  };

  const isValidDropTarget = (targetDecisionId: string) => {
    if (!draggedBranch) return false;
    if (draggedBranch.sourceDecisionId === targetDecisionId) return false;

    const movingBranch = findConditionBranch(
      path,
      draggedBranch.sourceDecisionId,
      draggedBranch.sourceConditionId,
    );
    if (!movingBranch) return false;

    return !containsDecisionId(movingBranch.next, targetDecisionId);
  };

  const isValidRootSwapTarget = (targetDecisionId: string) => {
    if (!isRootDragging) return false;
    return targetDecisionId !== path.id;
  };

  const handleDecisionDragEnter = (decisionId: string) => {
    if (isValidDropTarget(decisionId) || isValidRootSwapTarget(decisionId)) {
      setDragOverDecisionId(decisionId);
      return;
    }

    if (!isValidDropTarget(decisionId)) {
      setDragOverDecisionId(null);
    }
  };

  const handleDecisionDragLeave = (decisionId: string) => {
    if (dragOverDecisionId === decisionId) {
      setDragOverDecisionId(null);
    }
  };

  const handleDecisionDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    decisionId: string,
  ) => {
    const isBranchDrop = isValidDropTarget(decisionId);
    const isRootSwap = isValidRootSwapTarget(decisionId);

    if (!isBranchDrop && !isRootSwap) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = isRootSwap ? "copy" : "move";
    setDragOverDecisionId(decisionId);
  };

  const handleRootDrop = (targetDecisionId: string) => {
    if (!isValidRootSwapTarget(targetDecisionId)) {
      handleRootDragEnd();
      return;
    }

    const result = swapRootDescriptionIntoTarget(
      path,
      targetDecisionId,
      path.description,
    );
    if (!result.swappedDescription) {
      handleRootDragEnd();
      toast.error("Unable to switch root description");
      return;
    }

    onUpdatePath({
      ...(result.updated as DecisionPath),
      description: result.swappedDescription,
    });

    handleRootDragEnd();
    toast.success("Root description switched");
  };

  const handleDecisionDrop = (targetDecisionId: string) => {
    if (isRootDragging) {
      handleRootDrop(targetDecisionId);
      return;
    }

    if (!draggedBranch) return;

    const { sourceDecisionId, sourceConditionId } = draggedBranch;
    setDragOverDecisionId(null);

    if (sourceDecisionId === targetDecisionId) {
      setDraggedBranch(null);
      return;
    }

    const removalResult = removeConditionBranch(
      path,
      sourceDecisionId,
      sourceConditionId,
    );
    if (!removalResult.removed) {
      setDraggedBranch(null);
      toast.error("Unable to move branch");
      return;
    }

    const movingBranch = removalResult.removed;
    if (containsDecisionId(movingBranch.next, targetDecisionId)) {
      setDraggedBranch(null);
      toast.error("Cannot move a branch into its own subtree");
      return;
    }

    const insertionResult = addConditionBranchToDecision(
      removalResult.updated,
      targetDecisionId,
      movingBranch,
    );
    if (!insertionResult.inserted) {
      setDraggedBranch(null);
      toast.error("Unable to find target decision");
      return;
    }

    onUpdatePath(insertionResult.updated as DecisionPath);
    setDraggedBranch(null);
    toast.success("Branch moved");
  };

  const getNodeIcon = (type: TreeNode["type"] | "decision") => {
    switch (type) {
      case "decision":
        return (
          <DiamondsFour weight="fill" className="text-decision-foreground" />
        );
      case "condition":
        return <GitBranch weight="fill" className="text-accent-foreground" />;
      case "outcome":
        return (
          <CheckCircle weight="fill" className="text-outcome-foreground" />
        );
      case "path-reference":
        return <FlowArrow weight="fill" className="text-path-ref-foreground" />;
    }
  };

  const getBranchTypeLabel = (node: TreeNode | DecisionPath) => {
    switch (node.type) {
      case "decision":
        return "Decision";
      case "condition":
        return "Condition";
      case "outcome":
        return "Outcome";
      case "path-reference":
        return "Path Reference";
      default:
        return "Unknown";
    }
  };

  const getNodeColor = (node: TreeNode | DecisionPath) => {
    switch (node.type) {
      case "decision":
        return { bg: colors.decision, fg: colors.decisionForeground };
      case "condition":
        return { bg: colors.accent, fg: colors.accentForeground };
      case "outcome":
        return getOutcomeColors(node);
      case "path-reference":
        return { bg: colors.pathRef, fg: colors.pathRefForeground };
    }
  };

  const getNodeLabel = (n: TreeNode | DecisionPath) => {
    if (n.type === "decision") return n.description;
    if (n.type === "condition") return n.description;
    if (n.type === "outcome") return n.description;
    if (n.type === "path-reference") {
      const p = paths.find((p) => p.id === n.pathId);
      return `→ ${p?.name || "Unknown"}`;
    }
  };

  const handleSavePathNote = () => {
    const normalized = pathNoteDraft.replace(/\r\n?/g, "\n");
    const nextValue = normalized.trim().length > 0 ? normalized : undefined;
    const currentValue = path.pathNote;

    if (nextValue === currentValue) return;

    onUpdatePath({
      ...path,
      pathNote: nextValue,
    });
  };

  const hasPathNote = !!path.pathNote?.trim();
  const hasCitedNotes = notedNodes.length > 0;

  const renderNotesSection = () => (
    <>
      <div className="mt-4 pt-4 border-t-2 border-border space-y-2">
        <Label
          htmlFor={`path-note-${path.id}`}
          className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Path Notes
        </Label>
        <Textarea
          id={`path-note-${path.id}`}
          placeholder="Add notes that apply to this entire path..."
          value={pathNoteDraft}
          onChange={(e) => setPathNoteDraft(e.target.value)}
          onBlur={handleSavePathNote}
          rows={3}
          className="whitespace-pre-wrap"
        />
      </div>

      {(hasPathNote || hasCitedNotes) && (
        <div className="mt-6 pt-4 border-t-2 border-border">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            <NotePencil size={15} />
            <span>Notes</span>
          </div>

          {hasPathNote && (
            <div className="mb-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Path Note
              </div>
              <p className="text-sm text-muted-foreground italic whitespace-pre-wrap break-words">
                {path.pathNote}
              </p>
            </div>
          )}

          {hasCitedNotes && (
            <>
              {hasPathNote && (
                <div className="border-t border-border/60 my-3" />
              )}
              <ol className="space-y-2">
                {notedNodes.map((item, i) => (
                  <li key={item.id} className="flex gap-2.5 text-sm">
                    <span className="shrink-0 font-bold font-mono text-current">
                      [{i + 1}]
                    </span>
                    <span className="text-muted-foreground italic whitespace-pre-wrap break-words">
                      {item.note}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </>
  );

  if (path.type === "decision") {
    const nodeColors = getNodeColor(path);
    const canDelete = !!onDeleteNode;
    const hasIncompleteConditions = incompleteConditionIds.size > 0;
    const conditionBeingEdited = (path.conditions || []).find(
      (c) => c.id === editingConditionId,
    );

    return (
      <div className="space-y-2 rounded-xl transition-all">
        {hasIncompleteConditions && depth === 0 && (
          <Alert variant="destructive" className="border-2">
            <WarningCircle className="h-5 w-5" weight="fill" />
            <AlertTitle>Incomplete Decision Tree</AlertTitle>
            <AlertDescription>
              This tree has {incompleteConditionIds.size} incomplete condition
              {incompleteConditionIds.size !== 1 ? "s" : ""} that need
              {incompleteConditionIds.size === 1 ? "s" : ""} an outcome or path
              reference. Every condition branch must end with either an outcome
              or a path reference.
            </AlertDescription>
          </Alert>
        )}

        <div
          className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer hover:opacity-90 transition-all ${getDropTargetClassName(dragOverDecisionId === path.id)}`}
          style={{
            backgroundColor: nodeColors.bg,
            color: nodeColors.fg,
            borderColor: nodeColors.fg,
          }}
          onClick={() => setIsExpanded(!isExpanded)}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "copy";
            event.dataTransfer.setData("text/plain", path.id);
            handleRootDragStart();
          }}
          onDragEnd={handleRootDragEnd}
          onDragEnter={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleDecisionDragEnter(path.id);
          }}
          onDragLeave={(event) => {
            event.stopPropagation();
            handleDecisionDragLeave(path.id);
          }}
          onDragOver={(event) => {
            event.stopPropagation();
            handleDecisionDragOver(event, path.id);
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleDecisionDrop(path.id);
          }}
        >
          {hasChildren(path) && (
            <div className="flex-shrink-0">
              {isExpanded ? <CaretDown size={20} /> : <CaretRight size={20} />}
            </div>
          )}
          {getNodeIcon(path.type)}
          <div className="flex-1">
            <div className="font-medium whitespace-pre-wrap break-words">
              {path.description}
              {citationMap.has(path.id) && (
                <span className="ml-1.5 text-xs font-bold font-mono text-current select-none">
                  [{citationMap.get(path.id)}]
                </span>
              )}
            </div>
            <div className="text-xs opacity-80 font-mono mt-1">
              Branch Type: {getBranchTypeLabel(path)}
            </div>
          </div>
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditDialogOpen(true)}
              className="h-8 w-8 p-0"
              title="Edit node"
            >
              <Pencil />
            </Button>
            {canDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDelete}
                className="h-8 w-8 p-0"
                title={
                  hasChildren(path)
                    ? "Cannot delete - has children"
                    : "Delete node"
                }
                disabled={hasChildren(path)}
              >
                <Trash className={hasChildren(path) ? "opacity-30" : ""} />
              </Button>
            )}
          </div>
        </div>

        <div
          className={getAccordionContentClassName(isExpanded)}
          aria-hidden={!isExpanded}
        >
          <div className="min-h-0 space-y-2">
            {path.conditions && path.conditions.length > 0 && (
              <div className="ml-6 space-y-3">
                {path.conditions.map((condition) => {
                  const isIncomplete = incompleteConditionIds.has(condition.id);
                  return (
                    <div
                      key={condition.id}
                      className={`border-l-2 border-border pl-4 transition-opacity ${draggedBranch?.sourceConditionId === condition.id ? "opacity-40" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="shrink-0 rounded-md border border-border/70 bg-muted/60 p-1 text-muted-foreground cursor-grab active:cursor-grabbing"
                            draggable
                            onDragStart={(event) => {
                              event.stopPropagation();
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData(
                                "text/plain",
                                condition.id,
                              );
                              handleBranchDragStart(path.id, condition.id);
                            }}
                            onDragEnd={handleBranchDragEnd}
                            title="Drag branch"
                          >
                            <DotsSixVertical size={16} weight="bold" />
                          </div>
                          <Badge
                            variant="outline"
                            className={`font-mono ${isIncomplete ? "border-destructive text-destructive border-2 animate-pulse" : ""}`}
                          >
                            <span className="whitespace-pre-wrap break-words">
                              {condition.description}
                            </span>
                            {citationMap.has(condition.id) && (
                              <span className="ml-1 text-xs font-bold text-current select-none">
                                [{citationMap.get(condition.id)}]
                              </span>
                            )}
                          </Badge>
                          {isIncomplete && (
                            <div className="flex items-center gap-1 text-destructive text-xs font-medium">
                              <WarningCircle size={16} weight="fill" />
                              <span>Missing end node</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingConditionId(condition.id)}
                            className="h-8 w-8 p-0"
                            title="Edit branch"
                            disabled={!condition.next}
                          >
                            <Pencil
                              className={!condition.next ? "opacity-30" : ""}
                            />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => requestDeleteCondition(condition)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            title="Delete branch"
                          >
                            <Trash />
                          </Button>
                        </div>
                      </div>
                      {condition.type === "condition" && (
                        <div className="ml-4">
                          <ConditionNodeEditor
                            condition={condition}
                            paths={paths}
                            currentPathId={currentPathId}
                            onUpdateCondition={(updated) =>
                              handleUpdateCondition(condition.id, updated)
                            }
                            depth={depth + 1}
                            citationMap={citationMap}
                            draggedBranch={draggedBranch}
                            dragOverDecisionId={dragOverDecisionId}
                            onBranchDragStart={handleBranchDragStart}
                            onBranchDragEnd={handleBranchDragEnd}
                            onDecisionDragEnter={handleDecisionDragEnter}
                            onDecisionDragLeave={handleDecisionDragLeave}
                            onDecisionDragOver={handleDecisionDragOver}
                            onDecisionDrop={handleDecisionDrop}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="ml-6 pl-4 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddDialogOpen(true)}
                className="w-full"
              >
                <Plus />
                Add Branch
              </Button>
            </div>
          </div>
        </div>

        <AddNodeDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          onAdd={handleAddCondition}
          paths={paths}
          currentPathId={currentPathId}
          mode="output"
          parentNodeType="condition"
          initialConditionDescription=""
        />

        <AddNodeDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onAdd={(_, newNode) => {
            const updatedPath = {
              ...(newNode as any),
              name: path.name,
            } as DecisionPath;
            onUpdatePath(updatedPath);
          }}
          paths={paths}
          currentPathId={currentPathId}
          mode="edit"
          initialNode={path as any}
          parentNodeType="condition"
          allowTypeChange={!hasChildren(path)}
        />

        {conditionBeingEdited?.next && (
          <AddNodeDialog
            open={editingConditionId === conditionBeingEdited.id}
            onOpenChange={(open) => {
              if (!open) setEditingConditionId(null);
            }}
            onAdd={(_, updatedNode, updatedConditionDescription) => {
              handleUpdateCondition(conditionBeingEdited.id, {
                ...conditionBeingEdited,
                description:
                  updatedConditionDescription?.trim() ||
                  conditionBeingEdited.description,
                next: updatedNode,
              });
              setEditingConditionId(null);
            }}
            paths={paths}
            currentPathId={currentPathId}
            mode="edit"
            initialNode={conditionBeingEdited.next}
            initialConditionDescription={conditionBeingEdited.description}
          />
        )}

        <AlertDialog
          open={deleteBranchDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              cancelDeleteCondition();
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Branch And Children?</AlertDialogTitle>
              <AlertDialogDescription>
                This branch contains child branches. Deleting it will also remove
                all of its children.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={cancelDeleteCondition}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteCondition}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Branch
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {renderNotesSection()}
      </div>
    );
  }

  if (path.type === "outcome" || path.type === "path-reference") {
    const nodeColors = getNodeColor(path);
    const canDelete = !!onDeleteNode;

    return (
      <div className="space-y-2">
        <div
          className="flex items-center gap-3 p-3 rounded-lg border-2"
          style={{
            backgroundColor: nodeColors.bg,
            color: nodeColors.fg,
            borderColor: nodeColors.fg,
          }}
        >
          {getNodeIcon(path.type)}
          <div className="flex-1">
            <div className="font-medium whitespace-pre-wrap break-words">
              <span className="whitespace-pre-wrap break-words">
                {getNodeLabel(path)}
              </span>
              {citationMap.has(path.id) && (
                <span className="ml-1.5 text-xs font-bold font-mono text-current select-none">
                  [{citationMap.get(path.id)}]
                </span>
              )}
            </div>
            <div className="text-xs opacity-80 font-mono mt-1">
              Branch Type: {getBranchTypeLabel(path)}
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditDialogOpen(true)}
              className="h-8 w-8 p-0"
              title="Edit node"
            >
              <Pencil />
            </Button>
            {canDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDelete}
                className="h-8 w-8 p-0"
                title="Delete node"
              >
                <Trash />
              </Button>
            )}
          </div>
        </div>

        <AddNodeDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onAdd={(_, newNode) => {
            const updatedPath = {
              ...(newNode as any),
              name: path.name,
            } as DecisionPath;
            onUpdatePath(updatedPath);
          }}
          paths={paths}
          currentPathId={currentPathId}
          mode="edit"
          initialNode={path as any}
          parentNodeType="condition"
          allowTypeChange
        />

        {renderNotesSection()}
      </div>
    );
  }

  return null;
}

interface ConditionNodeEditorProps {
  condition: ConditionNode;
  paths: DecisionPath[];
  currentPathId: string;
  onUpdateCondition: (condition: ConditionNode) => void;
  depth: number;
  citationMap: Map<string, number>;
  draggedBranch: DraggedBranch | null;
  dragOverDecisionId: string | null;
  onBranchDragStart: (
    sourceDecisionId: string,
    sourceConditionId: string,
  ) => void;
  onBranchDragEnd: () => void;
  onDecisionDragEnter: (decisionId: string) => void;
  onDecisionDragLeave: (decisionId: string) => void;
  onDecisionDragOver: (
    event: React.DragEvent<HTMLDivElement>,
    decisionId: string,
  ) => void;
  onDecisionDrop: (decisionId: string) => void;
}

function ConditionNodeEditor({
  condition,
  paths,
  currentPathId,
  onUpdateCondition,
  depth,
  citationMap,
  draggedBranch,
  dragOverDecisionId,
  onBranchDragStart,
  onBranchDragEnd,
  onDecisionDragEnter,
  onDecisionDragLeave,
  onDecisionDragOver,
  onDecisionDrop,
}: ConditionNodeEditorProps) {
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [editingNestedConditionId, setEditingNestedConditionId] = useState<
    string | null
  >(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [deleteNestedBranchDialogOpen, setDeleteNestedBranchDialogOpen] =
    useState(false);
  const [nestedBranchToDeleteId, setNestedBranchToDeleteId] = useState<
    string | null
  >(null);
  const colors = useNodeColors();

  const hasChildren = (node: TreeNode): boolean => {
    if (node.type === "decision") {
      return (node.conditions && node.conditions.length > 0) || false;
    }
    if (node.type === "condition") {
      return !!node.next;
    }
    return false;
  };

  const handleAddChild = (_: string, newNode: TreeNode) => {
    onUpdateCondition({ ...condition, next: newNode });
  };

  const handleUpdateNode = (updates: Partial<TreeNode>) => {
    onUpdateCondition({ ...condition, ...updates } as any);
  };

  const deleteNestedCondition = (conditionId: string) => {
    if (!condition.next || condition.next.type !== "decision") return;

    const nextDecision = condition.next;
    const updatedConditions = (nextDecision.conditions || []).filter(
      (c) => c.id !== conditionId,
    );

    onUpdateCondition({
      ...condition,
      next: {
        ...nextDecision,
        conditions: updatedConditions,
      },
    });
    toast.success("Branch deleted");
  };

  const requestDeleteNestedCondition = (nestedCondition: ConditionNode) => {
    if (!hasDescendantBranches(nestedCondition)) {
      deleteNestedCondition(nestedCondition.id);
      return;
    }

    setNestedBranchToDeleteId(nestedCondition.id);
    setDeleteNestedBranchDialogOpen(true);
  };

  const confirmDeleteNestedCondition = () => {
    if (nestedBranchToDeleteId) {
      deleteNestedCondition(nestedBranchToDeleteId);
    }
    setDeleteNestedBranchDialogOpen(false);
    setNestedBranchToDeleteId(null);
  };

  const cancelDeleteNestedCondition = () => {
    setDeleteNestedBranchDialogOpen(false);
    setNestedBranchToDeleteId(null);
  };

  const getNodeIcon = (type: TreeNode["type"]) => {
    switch (type) {
      case "decision":
        return (
          <DiamondsFour weight="fill" className="text-decision-foreground" />
        );
      case "condition":
        return <GitBranch weight="fill" className="text-accent-foreground" />;
      case "outcome":
        return (
          <CheckCircle weight="fill" className="text-outcome-foreground" />
        );
      case "path-reference":
        return <FlowArrow weight="fill" className="text-path-ref-foreground" />;
    }
  };

  const getBranchTypeLabel = (node: TreeNode) => {
    switch (node.type) {
      case "decision":
        return "Decision";
      case "condition":
        return "Condition";
      case "outcome":
        return "Outcome";
      case "path-reference":
        return "Path Reference";
      default:
        return "Unknown";
    }
  };

  const getOutcomeColors = (node: OutcomeNode) => {
    switch (node.outcomeType || "neutral") {
      case "success":
        return { bg: colors.outcome, fg: colors.outcomeForeground };
      case "fail":
        return { bg: "oklch(0.62 0.20 25)", fg: "oklch(0.98 0 0)" };
      case "neutral":
      default:
        return { bg: "oklch(0.58 0.10 235)", fg: "oklch(0.98 0 0)" };
    }
  };

  const getNodeColor = (node: TreeNode) => {
    switch (node.type) {
      case "decision":
        return { bg: colors.decision, fg: colors.decisionForeground };
      case "condition":
        return { bg: colors.accent, fg: colors.accentForeground };
      case "outcome":
        return getOutcomeColors(node);
      case "path-reference":
        return { bg: colors.pathRef, fg: colors.pathRefForeground };
    }
  };

  const getNodeLabel = (n: TreeNode) => {
    if (n.type === "decision") return n.description;
    if (n.type === "condition") return n.description;
    if (n.type === "outcome") return n.description;
    if (n.type === "path-reference") {
      const path = paths.find((p) => p.id === n.pathId);
      return `→ ${path?.name || "Unknown"}`;
    }
  };

  if (condition.next) {
    const next = condition.next;

    if (next.type === "decision") {
      const nestedConditionBeingEdited = (next.conditions || []).find(
        (c) => c.id === editingNestedConditionId,
      );

      return (
        <div className="space-y-2 rounded-xl transition-all">
          <div
            className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer hover:opacity-90 transition-all ${getDropTargetClassName(dragOverDecisionId === next.id)}`}
            style={{
              backgroundColor: getNodeColor(next).bg,
              color: getNodeColor(next).fg,
              borderColor: getNodeColor(next).fg,
            }}
            onClick={() => setIsExpanded(!isExpanded)}
            onDragEnter={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDecisionDragEnter(next.id);
            }}
            onDragLeave={(event) => {
              event.stopPropagation();
              onDecisionDragLeave(next.id);
            }}
            onDragOver={(event) => {
              event.stopPropagation();
              onDecisionDragOver(event, next.id);
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDecisionDrop(next.id);
            }}
          >
            {hasChildren(next) && (
              <div className="flex-shrink-0">
                {isExpanded ? (
                  <CaretDown size={20} />
                ) : (
                  <CaretRight size={20} />
                )}
              </div>
            )}
            {getNodeIcon(next.type)}
            <div className="flex-1">
              <div className="font-medium whitespace-pre-wrap break-words">
                {next.description}
                {citationMap.has(next.id) && (
                  <span className="ml-1.5 text-xs font-bold font-mono text-current select-none">
                    [{citationMap.get(next.id)}]
                  </span>
                )}
              </div>
              <div className="text-xs opacity-80 font-mono mt-1">
                Branch Type: {getBranchTypeLabel(next)}
              </div>
            </div>
          </div>

          <div
            className={getAccordionContentClassName(isExpanded)}
            aria-hidden={!isExpanded}
          >
            <div className="min-h-0 space-y-2">
              {next.conditions && next.conditions.length > 0 && (
                <div className="ml-6 space-y-3">
                  {next.conditions.map((cond) => (
                    <div
                      key={cond.id}
                      className={`border-l-2 border-border pl-4 transition-opacity ${draggedBranch?.sourceConditionId === cond.id ? "opacity-40" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="shrink-0 rounded-md border border-border/70 bg-muted/60 p-1 text-muted-foreground cursor-grab active:cursor-grabbing"
                            draggable
                            onDragStart={(event) => {
                              event.stopPropagation();
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", cond.id);
                              onBranchDragStart(next.id, cond.id);
                            }}
                            onDragEnd={onBranchDragEnd}
                            title="Drag branch"
                          >
                            <DotsSixVertical size={16} weight="bold" />
                          </div>
                          <Badge variant="outline" className="font-mono">
                            <span className="whitespace-pre-wrap break-words">
                              {cond.description}
                            </span>
                            {citationMap.has(cond.id) && (
                              <span className="ml-1 text-xs font-bold text-current select-none">
                                [{citationMap.get(cond.id)}]
                              </span>
                            )}
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingNestedConditionId(cond.id)}
                            className="h-8 w-8 p-0"
                            title="Edit branch"
                            disabled={!cond.next}
                          >
                            <Pencil
                              className={!cond.next ? "opacity-30" : ""}
                            />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => requestDeleteNestedCondition(cond)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            title="Delete branch"
                          >
                            <Trash />
                          </Button>
                        </div>
                      </div>
                      <div className="ml-4">
                        <ConditionNodeEditor
                          condition={cond}
                          paths={paths}
                          currentPathId={currentPathId}
                          onUpdateCondition={(updated) => {
                            const updatedConditions = (
                              next.conditions || []
                            ).map((c) => (c.id === cond.id ? updated : c));
                            onUpdateCondition({
                              ...condition,
                              next: {
                                ...next,
                                conditions: updatedConditions,
                              },
                            });
                          }}
                          depth={depth + 1}
                          citationMap={citationMap}
                          draggedBranch={draggedBranch}
                          dragOverDecisionId={dragOverDecisionId}
                          onBranchDragStart={onBranchDragStart}
                          onBranchDragEnd={onBranchDragEnd}
                          onDecisionDragEnter={onDecisionDragEnter}
                          onDecisionDragLeave={onDecisionDragLeave}
                          onDecisionDragOver={onDecisionDragOver}
                          onDecisionDrop={onDecisionDrop}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="ml-6 pl-4 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddChildOpen(true)}
                  className="w-full"
                >
                  <Plus />
                  Add Branch
                </Button>
              </div>
            </div>
          </div>

          <AddNodeDialog
            open={addChildOpen}
            onOpenChange={setAddChildOpen}
            onAdd={(_, newNode, conditionDescription) => {
              const description = (conditionDescription || "").trim();
              if (!description) {
                toast.error("Condition label is required");
                return;
              }
              const conditions = next.conditions || [];
              onUpdateCondition({
                ...condition,
                next: {
                  ...next,
                  conditions: [
                    ...conditions,
                    {
                      id: generateId(),
                      type: "condition",
                      description,
                      next: newNode,
                    },
                  ],
                },
              });
            }}
            paths={paths}
            currentPathId={currentPathId}
            mode="output"
            parentNodeType="condition"
            initialConditionDescription=""
          />

          {nestedConditionBeingEdited?.next && (
            <AddNodeDialog
              open={editingNestedConditionId === nestedConditionBeingEdited.id}
              onOpenChange={(open) => {
                if (!open) setEditingNestedConditionId(null);
              }}
              onAdd={(_, updatedNode, updatedConditionDescription) => {
                const updatedConditions = (next.conditions || []).map((c) =>
                  c.id === nestedConditionBeingEdited.id
                    ? {
                        ...nestedConditionBeingEdited,
                        description:
                          updatedConditionDescription?.trim() ||
                          nestedConditionBeingEdited.description,
                        next: updatedNode,
                      }
                    : c,
                );

                onUpdateCondition({
                  ...condition,
                  next: {
                    ...next,
                    conditions: updatedConditions,
                  },
                });

                setEditingNestedConditionId(null);
              }}
              paths={paths}
              currentPathId={currentPathId}
              mode="edit"
              initialNode={nestedConditionBeingEdited.next}
              initialConditionDescription={
                nestedConditionBeingEdited.description
              }
            />
          )}

          <AlertDialog
            open={deleteNestedBranchDialogOpen}
            onOpenChange={(open) => {
              if (!open) {
                cancelDeleteNestedCondition();
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Branch And Children?</AlertDialogTitle>
                <AlertDialogDescription>
                  This branch contains child branches. Deleting it will also
                  remove all of its children.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={cancelDeleteNestedCondition}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmDeleteNestedCondition}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Branch
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      );
    }

    const nodeColors = getNodeColor(next);
    return (
      <div>
        <div
          className="flex items-center gap-3 p-3 rounded-lg border-2"
          style={{
            backgroundColor: nodeColors.bg,
            color: nodeColors.fg,
            borderColor: nodeColors.fg,
          }}
        >
          {getNodeIcon(next.type)}
          <div className="flex-1">
            <div className="font-medium whitespace-pre-wrap break-words">
              <span className="whitespace-pre-wrap break-words">
                {getNodeLabel(next)}
              </span>
              {citationMap.has(next.id) && (
                <span className="ml-1.5 text-xs font-bold font-mono text-current select-none">
                  [{citationMap.get(next.id)}]
                </span>
              )}
            </div>
            <div className="text-xs opacity-80 font-mono mt-1">
              Branch Type: {getBranchTypeLabel(next)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setAddChildOpen(true)}
        className="w-full"
      >
        <Plus />
        Add Content
      </Button>

      <AddNodeDialog
        open={addChildOpen}
        onOpenChange={setAddChildOpen}
        onAdd={handleAddChild}
        paths={paths}
        currentPathId={currentPathId}
        mode="output"
        parentNodeType="condition"
      />
    </>
  );
}
