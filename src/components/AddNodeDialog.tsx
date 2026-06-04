import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DecisionPath, OutcomeStatus, TreeNode } from "@/lib/types";
import { generateId, hasCircularReference } from "@/lib/tree-utils";
import { useState, useEffect } from "react";

interface AddNodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (
    branchLabel: string,
    node: TreeNode,
    conditionDescription?: string,
  ) => void;
  paths: DecisionPath[];
  currentPathId: string;
  mode: "output" | "edit";
  initialNode?: TreeNode;
  parentNodeType?: "decision" | "condition" | null;
  allowTypeChange?: boolean;
  initialConditionDescription?: string;
}

export function AddNodeDialog({
  open,
  onOpenChange,
  onAdd,
  paths,
  currentPathId,
  mode,
  initialNode,
  parentNodeType = null,
  allowTypeChange = false,
  initialConditionDescription,
}: AddNodeDialogProps) {
  const [nodeType, setNodeType] = useState<
    "decision" | "outcome" | "path-reference" | "condition"
  >("condition");
  const [description, setDescription] = useState("");
  const [selectedPathId, setSelectedPathId] = useState("");
  const [conditionDescription, setConditionDescription] = useState("");
  const [incomingConditionDescription, setIncomingConditionDescription] =
    useState("");
  const [note, setNote] = useState("");
  const [outcomeType, setOutcomeType] = useState<OutcomeStatus>("neutral");

  useEffect(() => {
    if (open && initialNode) {
      setNodeType(initialNode.type);
      if (initialNode.type === "decision") {
        setDescription(initialNode.description);
      } else if (initialNode.type === "outcome") {
        setDescription(initialNode.description);
        setOutcomeType(initialNode.outcomeType || "neutral");
      } else if (initialNode.type === "path-reference") {
        setSelectedPathId(initialNode.pathId);
      } else if (initialNode.type === "condition") {
        setConditionDescription(initialNode.description);
      }
      setNote((initialNode as any).note || "");
      setIncomingConditionDescription(initialConditionDescription || "");
    } else if (open) {
      setDescription("");
      setSelectedPathId("");
      setConditionDescription("");
      setIncomingConditionDescription(initialConditionDescription || "");
      setNote("");
      setOutcomeType("neutral");

      if (parentNodeType === "decision") {
        setNodeType("condition");
      } else if (parentNodeType === "condition") {
        setNodeType("decision");
      } else {
        setNodeType("condition");
      }
    }
  }, [open, initialNode, parentNodeType, initialConditionDescription]);

  const handleSubmit = () => {
    let node: TreeNode;

    const trimmedNote = note.trim() || undefined;

    if (nodeType === "decision") {
      node = {
        id: initialNode?.id || generateId(),
        type: "decision",
        description: description.trim(),
        conditions:
          initialNode?.type === "decision" ? initialNode.conditions : undefined,
        note: trimmedNote,
      };
    } else if (nodeType === "condition") {
      const childNode =
        initialNode?.type === "condition" ? initialNode.next : undefined;
      node = {
        id: initialNode?.id || generateId(),
        type: "condition",
        description: conditionDescription.trim(),
        next: childNode,
        note: trimmedNote,
      };
    } else if (nodeType === "outcome") {
      node = {
        id: initialNode?.id || generateId(),
        type: "outcome",
        description: description.trim(),
        note: trimmedNote,
        outcomeType,
      };
    } else {
      node = {
        id: initialNode?.id || generateId(),
        type: "path-reference",
        pathId: selectedPathId,
        note: trimmedNote,
      };
    }

    onAdd("", node, incomingConditionDescription.trim() || undefined);
    onOpenChange(false);
  };

  const isValid = () => {
    if (
      initialConditionDescription !== undefined &&
      !incomingConditionDescription.trim()
    )
      return false;
    if (nodeType === "decision" && !description.trim()) return false;
    if (nodeType === "condition" && !conditionDescription.trim()) return false;
    if (nodeType === "outcome" && !description.trim()) return false;
    if (nodeType === "path-reference" && !selectedPathId) return false;
    if (
      nodeType === "path-reference" &&
      hasCircularReference(paths, currentPathId, selectedPathId)
    )
      return false;
    return true;
  };

  const availablePaths = paths.filter((p) => p.id !== currentPathId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit Node" : "Add Output"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update the node details below."
              : "Add an output to this decision point."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {initialConditionDescription !== undefined && (
            <div className="space-y-2">
              <Label htmlFor="incoming-condition">Condition</Label>
              <Input
                id="incoming-condition"
                placeholder="Condition that leads to this node"
                value={incomingConditionDescription}
                onChange={(e) =>
                  setIncomingConditionDescription(e.target.value)
                }
              />
              <p className="text-xs text-muted-foreground">
                This is the branch label that determines when this node is
                reached.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="node-type">Branch Type</Label>
            <Select
              value={nodeType}
              onValueChange={(value: any) => setNodeType(value)}
              disabled={mode === "edit" && !allowTypeChange}
            >
              <SelectTrigger id="node-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {parentNodeType === "decision" && (
                  <SelectItem value="condition">Condition</SelectItem>
                )}
                {parentNodeType === "condition" && (
                  <>
                    <SelectItem value="decision">Decision</SelectItem>
                    <SelectItem value="outcome">Outcome</SelectItem>
                    <SelectItem value="path-reference">
                      Path Reference
                    </SelectItem>
                  </>
                )}
                {!parentNodeType && mode === "edit" && (
                  <>
                    <SelectItem value="decision">Decision</SelectItem>
                    <SelectItem value="condition">Condition</SelectItem>
                    <SelectItem value="outcome">Outcome</SelectItem>
                    <SelectItem value="path-reference">
                      Path Reference
                    </SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
            {mode === "edit" && !allowTypeChange && (
              <p className="text-xs text-muted-foreground">
                Branch type cannot be changed after creation. Delete and
                recreate if needed.
              </p>
            )}
          </div>

          {nodeType === "decision" && (
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What question should this decision answer?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {nodeType === "condition" && (
            <div className="space-y-2">
              <Label htmlFor="output-label">Output Label</Label>
              <Input
                id="output-label"
                placeholder="e.g., Yes, No, Approved, Verified"
                value={conditionDescription}
                onChange={(e) => setConditionDescription(e.target.value)}
              />
            </div>
          )}

          {nodeType === "outcome" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="description">Outcome Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the final outcome"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outcome-type">Outcome Type</Label>
                <Select
                  value={outcomeType}
                  onValueChange={(value: OutcomeStatus) =>
                    setOutcomeType(value)
                  }
                >
                  <SelectTrigger id="outcome-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="fail">Fail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {nodeType === "path-reference" && (
            <div className="space-y-2">
              <Label htmlFor="path-reference">Reference Path</Label>
              <Select value={selectedPathId} onValueChange={setSelectedPathId}>
                <SelectTrigger id="path-reference">
                  <SelectValue placeholder="Select a path to reference" />
                </SelectTrigger>
                <SelectContent>
                  {availablePaths.map((path) => (
                    <SelectItem
                      key={path.id}
                      value={path.id}
                      disabled={hasCircularReference(
                        paths,
                        currentPathId,
                        path.id,
                      )}
                    >
                      {path.name}
                      {hasCircularReference(paths, currentPathId, path.id) &&
                        " (circular ref)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availablePaths.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No other paths available to reference. Create more paths
                  first.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="node-note">
              Notes{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Textarea
              id="node-note"
              placeholder="Add any notes or context for this node..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid()}>
            {mode === "edit" ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
