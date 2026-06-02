import { DecisionPath, TreeNode } from '@/lib/types'
import * as d3 from 'd3'
import { useEffect, useRef, useState } from 'react'
import { Button } from './ui/button'
import { Plus, Minus, ArrowsOut } from '@phosphor-icons/react'

interface FlowchartProps {
  paths: DecisionPath[]
  selectedPathId?: string
}

const TURQUOISE_COLORS = {
  decision: 'oklch(0.75 0.12 195)',
  outcome: 'oklch(0.68 0.10 195)',
  pathRef: 'oklch(0.82 0.14 195)',
}

interface HierarchyNode {
  id: string
  type: 'decision' | 'outcome' | 'path-reference' | 'start' | 'condition'
  label: string
  pathId?: string
  children?: HierarchyNode[]
  branchLabel?: string
}

export function Flowchart({ paths, selectedPathId }: FlowchartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [startPan, setStartPan] = useState({ x: 0, y: 0 })
  const [isAnimating, setIsAnimating] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      
      const rect = container.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.min(Math.max(zoom * delta, 0.1), 5)
      
      const zoomRatio = newZoom / zoom
      setPan(prev => ({
        x: mouseX - (mouseX - prev.x) * zoomRatio,
        y: mouseY - (mouseY - prev.y) * zoomRatio
      }))
      setZoom(newZoom)
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && !isAnimating) {
        setIsPanning(true)
        setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y })
        container.style.cursor = 'grabbing'
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        setPan({
          x: e.clientX - startPan.x,
          y: e.clientY - startPan.y
        })
      }
    }

    const handleMouseUp = () => {
      setIsPanning(false)
      container.style.cursor = 'grab'
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    container.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [zoom, pan, isPanning, startPan, isAnimating])

  useEffect(() => {
    if (!svgRef.current) return
    
    const selectedPath = selectedPathId 
      ? paths.find(p => p.id === selectedPathId)
      : paths[0]
    
    if (!selectedPath) return

    function getPathToNode(nodeId: string, root: any): Set<string> {
      const pathSet = new Set<string>()
      
      function traverse(node: any): boolean {
        if (!node) return false
        
        if (node.data.id === nodeId) {
          pathSet.add(node.data.id)
          return true
        }
        
        if (node.children) {
          for (const child of node.children) {
            if (traverse(child)) {
              pathSet.add(node.data.id)
              return true
            }
          }
        }
        
        return false
      }
      
      traverse(root)
      return pathSet
    }

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
      } else if (node.type === 'condition') {
        hierarchyNode.label = node.label
        if (node.node) {
          const child = buildHierarchy(node.node)
          hierarchyNode.children = [child]
        }
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

    const highlightedPath = selectedNodeId ? getPathToNode(selectedNodeId, root) : new Set<string>()

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

    const linkGroup = g.append('g')
      .attr('fill', 'none')

    const labelBoxHeight = 32
    const labelBoxPadding = 8

    linkGroup.selectAll('path')
      .data(links)
      .join('path')
      .attr('d', d => {
        const sourceY = d.source.y + nodeHeight / 2
        const targetY = d.target.y - nodeHeight / 2
        const midY = (sourceY + targetY) / 2
        
        const labelBoxTop = midY - labelBoxHeight / 2
        const labelBoxBottom = midY + labelBoxHeight / 2
        
        return `M ${d.source.x},${sourceY}
                L ${d.source.x},${labelBoxTop}
                M ${d.source.x},${labelBoxBottom}
                C ${d.source.x},${(labelBoxBottom + targetY) / 2}
                  ${d.target.x},${(labelBoxBottom + targetY) / 2}
                  ${d.target.x},${targetY}`
      })
      .attr('stroke', d => {
        const isHighlighted = highlightedPath.has(d.source.data.id) && highlightedPath.has(d.target.data.id)
        return isHighlighted ? 'oklch(0.65 0.18 210)' : 'oklch(0.45 0.15 250)'
      })
      .attr('stroke-width', d => {
        const isHighlighted = highlightedPath.has(d.source.data.id) && highlightedPath.has(d.target.data.id)
        return isHighlighted ? 3 : 2
      })

    const labelBoxes = g.append('g')
      .selectAll('g')
      .data(links.filter(d => d.target.data.branchLabel))
      .join('g')
      .attr('transform', d => {
        const sourceY = d.source.y + nodeHeight / 2
        const targetY = d.target.y - nodeHeight / 2
        const midY = (sourceY + targetY) / 2
        return `translate(${d.source.x},${midY})`
      })

    labelBoxes.each(function(d) {
      const g = d3.select(this)
      const label = d.target.data.branchLabel || ''
      
      const textElement = g.append('text')
        .attr('font-size', 11)
        .attr('font-weight', 500)
        .attr('fill', 'oklch(0.45 0.15 250)')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .text(label)
      
      const bbox = (textElement.node() as SVGTextElement).getBBox()
      const boxWidth = bbox.width + labelBoxPadding * 2
      
      g.insert('rect', 'text')
        .attr('x', -boxWidth / 2)
        .attr('y', -labelBoxHeight / 2)
        .attr('width', boxWidth)
        .attr('height', labelBoxHeight)
        .attr('fill', 'oklch(0.98 0.005 250)')
        .attr('stroke', 'oklch(0.45 0.15 250)')
        .attr('stroke-width', 1.5)
        .attr('rx', 4)
    })

    const nodeGroup = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer')
      .on('click', function(event, d) {
        event.stopPropagation()
        setSelectedNodeId(prevId => prevId === d.data.id ? null : d.data.id)
      })
      .on('dblclick', function(event, d) {
        event.stopPropagation()
        
        const container = containerRef.current
        if (!container) return
        
        setIsAnimating(true)
        
        const rect = container.getBoundingClientRect()
        const centerX = rect.width / 2
        const centerY = rect.height / 2
        
        const targetZoom = Math.min(zoom * 1.5, 3)
        
        const newPanX = centerX - (d.x + offsetX) * targetZoom
        const newPanY = centerY - (d.y + offsetY) * targetZoom
        
        const startZoom = zoom
        const startPanX = pan.x
        const startPanY = pan.y
        const duration = 500
        const startTime = Date.now()
        
        const animate = () => {
          const elapsed = Date.now() - startTime
          const progress = Math.min(elapsed / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          
          setZoom(startZoom + (targetZoom - startZoom) * eased)
          setPan({
            x: startPanX + (newPanX - startPanX) * eased,
            y: startPanY + (newPanY - startPanY) * eased
          })
          
          if (progress < 1) {
            requestAnimationFrame(animate)
          } else {
            setIsAnimating(false)
          }
        }
        
        requestAnimationFrame(animate)
      })

    nodeGroup.each(function(d) {
      const g = d3.select(this)
      const nodeData = d.data
      
      const shapeWidth = 160
      const shapeHeight = 70
      
      const isHighlighted = highlightedPath.has(nodeData.id)
      
      let borderRadius = 0
      let fillColor = ''
      let strokeColor = ''
      let strokeWidth = 2
      
      if (nodeData.type === 'start') {
        borderRadius = 8
        fillColor = 'oklch(0.45 0.15 250)'
        strokeColor = isHighlighted ? 'oklch(0.65 0.18 210)' : 'oklch(0.45 0.15 250)'
        strokeWidth = isHighlighted ? 4 : 2
      } else if (nodeData.type === 'decision') {
        borderRadius = 4
        fillColor = TURQUOISE_COLORS.decision
        strokeColor = isHighlighted ? 'oklch(0.65 0.18 210)' : 'oklch(0.25 0.05 195)'
        strokeWidth = isHighlighted ? 4 : 2
      } else if (nodeData.type === 'outcome') {
        borderRadius = 35
        fillColor = TURQUOISE_COLORS.outcome
        strokeColor = isHighlighted ? 'oklch(0.65 0.18 210)' : 'oklch(0.25 0.05 195)'
        strokeWidth = isHighlighted ? 4 : 2
      } else if (nodeData.type === 'path-reference') {
        borderRadius = 16
        fillColor = TURQUOISE_COLORS.pathRef
        strokeColor = isHighlighted ? 'oklch(0.65 0.18 210)' : 'oklch(0.25 0.05 195)'
        strokeWidth = isHighlighted ? 4 : 2
      }
      
      if (nodeData.type === 'start') {
        const radius = 50
        g.append('circle')
          .attr('r', radius)
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('fill', fillColor)
          .attr('stroke', strokeColor)
          .attr('stroke-width', strokeWidth)
      } else {
        g.append('rect')
          .attr('width', shapeWidth)
          .attr('height', shapeHeight)
          .attr('x', -shapeWidth / 2)
          .attr('y', -shapeHeight / 2)
          .attr('fill', fillColor)
          .attr('stroke', strokeColor)
          .attr('stroke-width', strokeWidth)
          .attr('rx', borderRadius)
      }

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

  }, [paths, selectedPathId, selectedNodeId])

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev * 0.8, 0.1))
  }

  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-full overflow-hidden bg-muted/20 rounded-lg border relative cursor-grab"
    >
      <div 
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          transition: isPanning || isAnimating ? 'none' : 'transform 0.1s ease-out'
        }}
      >
        <svg ref={svgRef} className="min-w-full min-h-full" />
      </div>
      
      <div className="absolute top-4 right-4 flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleZoomIn}
          title="Zoom In"
          className="h-9 w-9 p-0 shadow-lg"
        >
          <Plus weight="bold" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleZoomOut}
          title="Zoom Out"
          className="h-9 w-9 p-0 shadow-lg"
        >
          <Minus weight="bold" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleReset}
          title="Reset View"
          className="h-9 w-9 p-0 shadow-lg"
        >
          <ArrowsOut weight="bold" />
        </Button>
      </div>
      
      <div className="absolute bottom-4 right-4 bg-card/90 backdrop-blur-sm border rounded-lg px-3 py-1.5 text-xs font-mono text-muted-foreground shadow-lg pointer-events-none">
        Zoom: {(zoom * 100).toFixed(0)}%
      </div>
    </div>
  )
}
