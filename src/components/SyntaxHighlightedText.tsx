import { TreeNode, DecisionPath } from '../lib/types'

interface SyntaxHighlightedTextProps {
  node: TreeNode | DecisionPath
  paths: DecisionPath[]
}

function renderNode(
  node: TreeNode | DecisionPath,
  paths: DecisionPath[],
  indent: number = 0,
  prefix: string = '',
  visitedPaths: Set<string> = new Set()
): JSX.Element[] {
  const indentStr = '\u00A0\u00A0'.repeat(indent)
  const elements: JSX.Element[] = []
  let keyCounter = 0

  if (node.type === 'decision') {
    elements.push(
      <div key={`${node.id}-${keyCounter++}`} className="leading-relaxed">
        <span className="text-muted-foreground">{indentStr}{prefix}</span>
        <span className="text-decision font-semibold">{node.question}</span>
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
        <span className="text-accent font-medium">[{node.label}]</span>
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
        <span className="text-outcome font-medium">✓ {node.description}</span>
      </div>
    )
  } else if (node.type === 'path-reference') {
    const referencedPath = paths.find(p => p.id === node.pathId)
    if (referencedPath) {
      if (visitedPaths.has(node.pathId)) {
        elements.push(
          <div key={`${node.id}-${keyCounter++}`} className="leading-relaxed">
            <span className="text-muted-foreground">{indentStr}{prefix}</span>
            <span className="text-path-ref font-medium">↻ Path: </span>
            <span className="text-path-ref-foreground italic">{referencedPath.name}</span>
            <span className="text-destructive"> (circular reference)</span>
          </div>
        )
      } else {
        elements.push(
          <div key={`${node.id}-${keyCounter++}`} className="leading-relaxed">
            <span className="text-muted-foreground">{indentStr}{prefix}</span>
            <span className="text-path-ref font-medium">→ Path: </span>
            <span className="text-path-ref-foreground italic">{referencedPath.name}</span>
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
          <span className="text-path-ref font-medium">→ Path: </span>
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
