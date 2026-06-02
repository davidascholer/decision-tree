import { DecisionPath, TreeNode, Branch } from '@/lib/types'
import * as d3 from 'd3'
import { useEffect, useRef } from 'react'

interface FlowchartProps {
  paths: DecisionPath[]
  selectedPathId?: string
}

interface FlowNode {
  id: string
  type: 'decision' | 'outcome' | 'path-reference' | 'start'
  label: string
  pathId?: string
  x?: number
  y?: number
  width?: number
  height?: number
}

interface FlowLink {
  source: string
  target: string
  label?: string
}

export function Flowchart({ paths, selectedPathId }: FlowchartProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return
    
    const selectedPath = selectedPathId 
      ? paths.find(p => p.id === selectedPathId)
      : paths[0]
    
    if (!selectedPath) return

    const nodes: FlowNode[] = []
    const links: FlowLink[] = []

    nodes.push({
      id: 'start',
      type: 'start',
      label: selectedPath.name
    })

    function processNode(node: TreeNode, parentId: string, branchLabel?: string) {
      const flowNode: FlowNode = {
        id: node.id,
        type: node.type,
        label: '',
        pathId: node.type === 'path-reference' ? node.pathId : undefined
      }

      if (node.type === 'decision') {
        flowNode.label = node.question
      } else if (node.type === 'outcome') {
        flowNode.label = node.description
      } else if (node.type === 'path-reference') {
        const referencedPath = paths.find(p => p.id === node.pathId)
        flowNode.label = referencedPath?.name || 'Unknown Path'
      }

      nodes.push(flowNode)
      links.push({ source: parentId, target: node.id, label: branchLabel })

      if (node.type === 'decision') {
        node.branches.forEach(branch => {
          processNode(branch.node, node.id, branch.label)
        })
      }
    }

    processNode(selectedPath.node, 'start')

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = 1200
    const height = Math.max(600, nodes.length * 100)
    
    svg.attr('width', width).attr('height', height)

    const g = svg.append('g')

    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(80))

    const defs = svg.append('defs')
    const marker = defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .attr('refX', 20)
      .attr('refY', 3)
      .attr('orient', 'auto')
    
    marker.append('polygon')
      .attr('points', '0 0, 10 3, 0 6')
      .attr('fill', 'oklch(0.45 0.15 250)')

    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', 'oklch(0.45 0.15 250)')
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead)')

    const linkLabels = g.append('g')
      .selectAll('text')
      .data(links)
      .join('text')
      .attr('font-size', 12)
      .attr('fill', 'oklch(0.55 0.02 250)')
      .attr('text-anchor', 'middle')
      .text(d => d.label || '')

    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag<any, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any)

    node.each(function(d) {
      const g = d3.select(this)
      
      if (d.type === 'start') {
        g.append('rect')
          .attr('width', 120)
          .attr('height', 50)
          .attr('x', -60)
          .attr('y', -25)
          .attr('fill', 'oklch(0.45 0.15 250)')
          .attr('rx', 8)
      } else if (d.type === 'decision') {
        g.append('path')
          .attr('d', 'M 0,-40 L 60,0 L 0,40 L -60,0 Z')
          .attr('fill', 'oklch(0.70 0.15 70)')
          .attr('stroke', 'oklch(0.25 0.05 70)')
          .attr('stroke-width', 2)
      } else if (d.type === 'outcome') {
        g.append('rect')
          .attr('width', 120)
          .attr('height', 50)
          .attr('x', -60)
          .attr('y', -25)
          .attr('fill', 'oklch(0.65 0.15 145)')
          .attr('stroke', 'oklch(0.25 0.08 145)')
          .attr('stroke-width', 2)
          .attr('rx', 25)
      } else if (d.type === 'path-reference') {
        g.append('rect')
          .attr('width', 120)
          .attr('height', 50)
          .attr('x', -60)
          .attr('y', -25)
          .attr('fill', 'oklch(0.60 0.15 290)')
          .attr('stroke', 'oklch(0.25 0.05 290)')
          .attr('stroke-width', 2)
          .attr('rx', 8)
      }

      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', d.type === 'start' ? 'oklch(0.98 0 0)' : 'oklch(0.15 0 0)')
        .attr('font-size', 13)
        .attr('font-weight', 500)
        .selectAll('tspan')
        .data(wrapText(d.label, 15))
        .join('tspan')
        .attr('x', 0)
        .attr('dy', (_, i) => i === 0 ? 0 : 14)
        .text(t => t)
    })

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      linkLabels
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2 - 10)

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      event.subject.fx = event.subject.x
      event.subject.fy = event.subject.y
    }

    function dragged(event: any) {
      event.subject.fx = event.x
      event.subject.fy = event.y
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0)
      event.subject.fx = null
      event.subject.fy = null
    }

    function wrapText(text: string, maxLength: number): string[] {
      const words = text.split(' ')
      const lines: string[] = []
      let currentLine = ''

      words.forEach(word => {
        if ((currentLine + word).length <= maxLength) {
          currentLine += (currentLine ? ' ' : '') + word
        } else {
          if (currentLine) lines.push(currentLine)
          currentLine = word
        }
      })
      if (currentLine) lines.push(currentLine)

      return lines.slice(0, 3)
    }

  }, [paths, selectedPathId])

  return (
    <div className="w-full h-full overflow-auto bg-muted/20 rounded-lg border">
      <svg ref={svgRef} className="min-w-full min-h-full" />
    </div>
  )
}
