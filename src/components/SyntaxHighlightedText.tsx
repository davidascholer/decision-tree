import { TreeNode, DecisionPath } from '../lib/types'
import { ReactElement } from 'react'

interface SyntaxHighlightedTextProps {
  node: TreeNode | DecisionPath
  paths: DecisionPath[]
}

const COLORS = {
  decision: 'oklch(0.72 0.15 195)',
  condition: 'oklch(0.88 0.08 210)',
  conditionForeground: 'oklch(0.25 0.05 210)',
  outcome: 'oklch(0.75 0.12 160)',
  pathRef: 'oklch(0.68 0.18 280)',
  pathRefForeground: 'oklch(0.98 0 0)',
}

function renderNode(
  node: TreeNode | DecisionPath,
  paths: DecisionPath[],
  indent: number = 0,
  prefix: string = '',
  visitedPaths: Set<string> = new Set()
): ReactElement[] {
  const indentStr = '\u00A0\u00A0'.repeat(indent)
  const elements: ReactElement[] = []
  let keyCounter = 0

  if (node.type === 'decision') {
    elements.push(
      <div key={`${node.id}-${keyCounter++}`} className="leading-relaxed">
        <span className="text-muted-foreground">{indentStr}{prefix}</span>
        <span className="font-semibold" style={{ color: COLORS.decision }}>{node.description}</span>
      </div>
    )
    
    if (node.conditions && node.conditions.length > 0) {
      node.conditions.forEach(condition => {
        elements.push(
          ...renderNode(
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
    elements.push(
      <div key={`${node.id}-${keyCounter++}`} className="leading-relaxed">
        <span className="text-muted-foreground">{indentStr}{prefix}└─ </span>
        <span className="font-medium" style={{ color: COLORS.conditionForeground }}>[{node.description}]</span>
      </div>
    )
    
    if (node.next) {
      elements.push(
        ...renderNode(
          node.next,
          paths,
          indent + 1,
          '   ',
          visitedPaths
        )
      )
    }
  } else if (node.type === 'outcome') {
    elements.push(
      <div key={`${node.id}-${keyCounter++}`} className="leading-relaxed">
        <span className="text-muted-foreground">{indentStr}{prefix}</span>
        <span className="font-medium" style={{ color: COLORS.outcome }}>✓ {node.description}</span>
      </div>
    )
  } else if (node.type === 'path-reference') {
    const referencedPath = paths.find(p => p.id === node.pathId)
    if (referencedPath) {
      if (visitedPaths.has(node.pathId)) {
        elements.push(
          <div key={`${node.id}-${keyCounter++}`} className="leading-relaxed">
            <span className="text-muted-foreground">{indentStr}{prefix}</span>
            <span className="font-medium" style={{ color: COLORS.pathRef }}>↻ Path: </span>
            <span className="italic" style={{ color: COLORS.pathRefForeground }}>{referencedPath.name}</span>
            <span className="text-destructive"> (circular reference)</span>
          </div>
        )
      } else {
        elements.push(
          <div key={`${node.id}-${keyCounter++}`} className="leading-relaxed">
            <span className="text-muted-foreground">{indentStr}{prefix}</span>
            <span className="font-medium" style={{ color: COLORS.pathRef }}>→ Path: </span>
            <span className="italic" style={{ color: COLORS.pathRefForeground }}>{referencedPath.name}</span>
          </div>
        )
        visitedPaths.add(node.pathId)
        elements.push(
          ...renderNode(
            referencedPath,
            paths,
            indent + 1,
            '  ',
            visitedPaths
          )
        )
      }
    } else {
      elements.push(
        <div key={`${node.id}-${keyCounter++}`} className="leading-relaxed">
          <span className="text-muted-foreground">{indentStr}{prefix}</span>
          <span className="font-medium" style={{ color: COLORS.pathRef }}>→ Path: </span>
          <span className="text-destructive">[Not Found]</span>
        </div>
      )
    }
  }

  return elements
}

export function SyntaxHighlightedText({ node, paths }: SyntaxHighlightedTextProps) {
  const elements = renderNode(node, paths, 0, '', new Set())

  return (
    <div className="font-mono text-sm">
      {elements}
    </div>
  )
}
