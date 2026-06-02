import { DecisionPath, TreeNode } from '@/lib/types'
import * as d3 from 'd3'
import { useEffect, useRef } from 'react'

interface FlowchartProps {
  paths: DecisionPath[]
  selectedPathId?: string
}

interface HierarchyNode {
  id: string
  type: 'decision' | 'outcome' | 'path-reference' | 'start'
  label: string
  pathId?: string
  children?: HierarchyNode[]
  branchLabel?: string
}

export function Flowchart({ paths, selectedPathId }: FlowchartProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return
    
    const selectedPath = selectedPathId 
      ? paths.find(p => p.id === selectedPathId)
      : paths[0]
    
    if (!selectedPath) return

    function buildHierarchy(node: TreeNode): HierarchyNode {
      const hierarchyNode: HierarchyNode = {
        id: node.id,
        type: node.type,
        label: '',
        pathId: node.type === 'path-reference' ? node.pathId : undefined,
        children: []
      }

      if (node.type === 'decision') {
        hierarchyNode.label = node.question
        hierarchyNode.children = node.branches.map(branch => {
          const child = buildHierarchy(branch.node)
          child.branchLabel = branch.label
          return child
        })
      } else if (node.type === 'outcome') {
        hierarchyNode.label = node.description
      } else if (node.type === 'path-reference') {
        const referencedPath = paths.find(p => p.id === node.pathId)
        hierarchyNode.label = referencedPath?.name || 'Unknown Path'
      }

      return hierarchyNode
    }

    const rootData: HierarchyNode = {
      id: 'start',
      type: 'start',
      label: selectedPath.name,
      children: [buildHierarchy(selectedPath.node)]
    }

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const nodeWidth = 180
    const nodeHeight = 80
    const horizontalSpacing = 80
    const verticalSpacing = 120

    const root = d3.hierarchy(rootData)
    const treeLayout = d3.tree<HierarchyNode>()
      .nodeSize([nodeWidth + horizontalSpacing, nodeHeight + verticalSpacing])
      .separation((a, b) => a.parent === b.parent ? 1 : 1.2)

    treeLayout(root)

    const nodes = root.descendants()
    const links = root.links()

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    nodes.forEach(node => {
      minX = Math.min(minX, node.x)
      maxX = Math.max(maxX, node.x)
      minY = Math.min(minY, node.y)
      maxY = Math.max(maxY, node.y)
    })

    const width = maxX - minX + nodeWidth + 100
    const height = maxY - minY + nodeHeight + 100
    const offsetX = -minX + 50
    const offsetY = -minY + 50

    svg.attr('width', width).attr('height', height)

    const g = svg.append('g')
      .attr('transform', `translate(${offsetX},${offsetY})`)

    const defs = svg.append('defs')
    const marker = defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .attr('refX', 8)
      .attr('refY', 3)
      .attr('orient', 'auto')
    
    marker.append('polygon')
      .attr('points', '0 0, 10 3, 0 6')
      .attr('fill', 'oklch(0.45 0.15 250)')

    const linkGroup = g.append('g')
      .attr('fill', 'none')
      .attr('stroke', 'oklch(0.45 0.15 250)')
      .attr('stroke-width', 2)

    linkGroup.selectAll('path')
      .data(links)
      .join('path')
      .attr('d', d => {
        const sourceY = d.source.y + nodeHeight / 2
        const targetY = d.target.y - nodeHeight / 2
        const midY = (sourceY + targetY) / 2
        
        return `M ${d.source.x},${sourceY}
                C ${d.source.x},${midY}
                  ${d.target.x},${midY}
                  ${d.target.x},${targetY}`
      })
      .attr('marker-end', 'url(#arrowhead)')

    const linkLabels = g.append('g')
      .selectAll('text')
      .data(links)
      .join('text')
      .attr('font-size', 11)
      .attr('font-weight', 500)
      .attr('fill', 'oklch(0.45 0.15 250)')
      .attr('text-anchor', 'middle')
      .attr('x', d => d.target.x)
      .attr('y', d => d.target.y - nodeHeight / 2 - 10)
      .text(d => d.target.data.branchLabel || '')

    const nodeGroup = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`)

    nodeGroup.each(function(d) {
      const g = d3.select(this)
      const nodeData = d.data
      
      const shapeWidth = 160
      const shapeHeight = 70
      
      let borderRadius = 0
      let fillColor = ''
      let strokeColor = ''
      
      if (nodeData.type === 'start') {
        borderRadius = 8
        fillColor = 'oklch(0.45 0.15 250)'
        strokeColor = 'oklch(0.45 0.15 250)'
      } else if (nodeData.type === 'decision') {
        borderRadius = 4
        fillColor = 'oklch(0.70 0.15 70)'
        strokeColor = 'oklch(0.25 0.05 70)'
      } else if (nodeData.type === 'outcome') {
        borderRadius = 35
        fillColor = 'oklch(0.65 0.15 145)'
        strokeColor = 'oklch(0.25 0.08 145)'
      } else if (nodeData.type === 'path-reference') {
        borderRadius = 16
        fillColor = 'oklch(0.60 0.15 290)'
        strokeColor = 'oklch(0.25 0.05 290)'
      }
      
      g.append('rect')
        .attr('width', shapeWidth)
        .attr('height', shapeHeight)
        .attr('x', -shapeWidth / 2)
        .attr('y', -shapeHeight / 2)
        .attr('fill', fillColor)
        .attr('stroke', strokeColor)
        .attr('stroke-width', 2)
        .attr('rx', borderRadius)

      const maxChars = 18
      const wrappedLines = wrapText(nodeData.label, maxChars)
      
      const textGroup = g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', nodeData.type === 'start' ? 'oklch(0.98 0 0)' : 'oklch(0.15 0 0)')
        .attr('font-size', 11)
        .attr('font-weight', 500)
      
      const lineHeight = 13
      const totalHeight = wrappedLines.length * lineHeight
      const startY = -(totalHeight / 2) + (lineHeight / 2)
      
      wrappedLines.forEach((line, i) => {
        textGroup.append('tspan')
          .attr('x', 0)
          .attr('y', startY + i * lineHeight)
          .text(line)
      })
    })

    function wrapText(text: string, maxChars: number): string[] {
      if (text.length <= maxChars) return [text]
      
      const words = text.split(' ')
      const lines: string[] = []
      let currentLine = ''

      words.forEach(word => {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        if (testLine.length <= maxChars) {
          currentLine = testLine
        } else {
          if (currentLine) lines.push(currentLine)
          currentLine = word
        }
      })
      
      if (currentLine) lines.push(currentLine)
      
      return lines.slice(0, 4)
    }

  }, [paths, selectedPathId])

  return (
    <div className="w-full h-full overflow-auto bg-muted/20 rounded-lg border">
      <svg ref={svgRef} className="min-w-full min-h-full" />
    </div>
  )
}
