import { DecisionPath, TreeNode, DecisionNode, ConditionNode } from '@/lib/types'
import { useEffect, useRef, useState } from 'react'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import { Label } from './ui/label'
import { Plus, Minus, ArrowsOut, Image as ImageIcon, FileCode, Download } from '@phosphor-icons/react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

interface FlowchartProps {
  paths: DecisionPath[]
  selectedPathId?: string
}

interface FlowNode {
  id: string
  type: 'decision' | 'outcome' | 'path-reference' | 'condition' | 'root'
  label: string
  x: number
  y: number
  width: number
  height: number
  pathId?: string
  children: FlowNode[]
  conditionLabel?: string
  parent?: FlowNode
  level: number
}

interface Connection {
  from: FlowNode
  to: FlowNode
  label?: string
}

const NODE_CONFIG = {
  decision: {
    width: 200,
    height: 90,
    color: 'oklch(0.72 0.15 195)',
    borderColor: 'oklch(0.45 0.18 195)',
    textColor: 'oklch(0.98 0 0)',
    borderRadius: 8,
    shadowColor: 'oklch(0.45 0.18 195 / 0.3)',
  },
  outcome: {
    width: 180,
    height: 70,
    color: 'oklch(0.75 0.12 160)',
    borderColor: 'oklch(0.48 0.15 160)',
    textColor: 'oklch(0.98 0 0)',
    borderRadius: 35,
    shadowColor: 'oklch(0.48 0.15 160 / 0.3)',
  },
  'path-reference': {
    width: 190,
    height: 80,
    color: 'oklch(0.68 0.18 280)',
    borderColor: 'oklch(0.42 0.20 280)',
    textColor: 'oklch(0.98 0 0)',
    borderRadius: 12,
    shadowColor: 'oklch(0.42 0.20 280 / 0.3)',
  },
  condition: {
    width: 160,
    height: 50,
    color: 'oklch(0.88 0.08 210)',
    borderColor: 'oklch(0.60 0.12 210)',
    textColor: 'oklch(0.25 0.05 210)',
    borderRadius: 25,
    shadowColor: 'oklch(0.60 0.12 210 / 0.2)',
  },
  root: {
    width: 220,
    height: 100,
    color: 'oklch(0.50 0.18 250)',
    borderColor: 'oklch(0.35 0.20 250)',
    textColor: 'oklch(0.98 0 0)',
    borderRadius: 10,
    shadowColor: 'oklch(0.35 0.20 250 / 0.4)',
  }
}

const HORIZONTAL_SPACING = 100
const VERTICAL_SPACING = 140
const CONDITION_VERTICAL_OFFSET = 80

export function Flowchart({ paths, selectedPathId }: FlowchartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [startPan, setStartPan] = useState({ x: 0, y: 0 })
  const [isAnimating, setIsAnimating] = useState(false)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [expandReferences, setExpandReferences] = useState(false)

  const selectedPath = selectedPathId 
    ? paths.find(p => p.id === selectedPathId)
    : paths[0]

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
      } else {
        const canvas = canvasRef.current
        if (!canvas || !selectedPath) return
        
        const rect = canvas.getBoundingClientRect()
        const mouseX = (e.clientX - rect.left - pan.x) / zoom
        const mouseY = (e.clientY - rect.top - pan.y) / zoom
        
        const nodes = getAllNodes(selectedPath, paths)
        let foundHover = false
        
        for (const node of nodes) {
          if (
            mouseX >= node.x - node.width / 2 &&
            mouseX <= node.x + node.width / 2 &&
            mouseY >= node.y - node.height / 2 &&
            mouseY <= node.y + node.height / 2
          ) {
            if (hoveredNode !== node.id) {
              setHoveredNode(node.id)
              container.style.cursor = 'pointer'
            }
            foundHover = true
            break
          }
        }
        
        if (!foundHover && hoveredNode) {
          setHoveredNode(null)
          container.style.cursor = 'grab'
        }
      }
    }

    const handleMouseUp = () => {
      setIsPanning(false)
      container.style.cursor = 'grab'
    }

    const handleClick = (e: MouseEvent) => {
      if (isPanning || !selectedPath) return
      
      const canvas = canvasRef.current
      if (!canvas) return
      
      const rect = canvas.getBoundingClientRect()
      const mouseX = (e.clientX - rect.left - pan.x) / zoom
      const mouseY = (e.clientY - rect.top - pan.y) / zoom
      
      const nodes = getAllNodes(selectedPath, paths)
      
      for (const node of nodes) {
        if (
          mouseX >= node.x - node.width / 2 &&
          mouseX <= node.x + node.width / 2 &&
          mouseY >= node.y - node.height / 2 &&
          mouseY <= node.y + node.height / 2
        ) {
          handleNodeClick(node, e)
          break
        }
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    container.addEventListener('mousedown', handleMouseDown)
    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseup', handleMouseUp)
    container.addEventListener('click', handleClick)

    return () => {
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('mousedown', handleMouseDown)
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseup', handleMouseUp)
      container.removeEventListener('click', handleClick)
      
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [zoom, pan, isPanning, startPan, isAnimating, hoveredNode, selectedPath, paths, expandReferences])

  const buildFlowTree = (node: TreeNode | DecisionPath, x: number, y: number, level: number, parent?: FlowNode, visitedPaths: Set<string> = new Set()): FlowNode | null => {
    if (node.type === 'path-reference' && expandReferences) {
      const referencedPath = paths.find(p => p.id === node.pathId)
      
      if (referencedPath && !visitedPaths.has(node.pathId)) {
        const newVisitedPaths = new Set(visitedPaths)
        newVisitedPaths.add(node.pathId)
        
        return buildFlowTree(referencedPath, x, y, level, parent, newVisitedPaths)
      }
      
      return null
    }
    
    const config = NODE_CONFIG[node.type] || NODE_CONFIG.decision
    
    const flowNode: FlowNode = {
      id: node.id,
      type: node.type,
      label: '',
      x,
      y,
      width: config.width,
      height: config.height,
      pathId: node.type === 'path-reference' ? node.pathId : undefined,
      children: [],
      parent,
      level
    }

    if (node.type === 'decision') {
      flowNode.label = node.description
      if (node.conditions && node.conditions.length > 0) {
        const totalWidth = (node.conditions.length - 1) * (config.width + HORIZONTAL_SPACING)
        const startX = x - totalWidth / 2

        node.conditions.forEach((condition, index) => {
          const childX = startX + index * (config.width + HORIZONTAL_SPACING)
          const childY = y + config.height / 2 + CONDITION_VERTICAL_OFFSET
          
          const conditionNode = buildFlowTree(condition, childX, childY, level + 1, flowNode, visitedPaths)
          if (conditionNode) {
            conditionNode.conditionLabel = condition.description
            flowNode.children.push(conditionNode)
          }
        })
      }
    } else if (node.type === 'condition') {
      flowNode.label = node.description
      if (node.next) {
        const nextY = y + config.height / 2 + VERTICAL_SPACING
        const nextNode = buildFlowTree(node.next, x, nextY, level + 1, flowNode, visitedPaths)
        if (nextNode) {
          flowNode.children.push(nextNode)
        }
      }
    } else if (node.type === 'outcome') {
      flowNode.label = node.description
    } else if (node.type === 'path-reference') {
      const referencedPath = paths.find(p => p.id === node.pathId)
      flowNode.label = referencedPath?.name || 'Unknown Path'
    }

    return flowNode
  }

  const getAllNodes = (path: DecisionPath | undefined, allPaths: DecisionPath[]): FlowNode[] => {
    if (!path) return []
    
    const rootConfig = NODE_CONFIG.root
    const rootNode: FlowNode = {
      id: 'root',
      type: 'root',
      label: path.name,
      x: 0,
      y: 0,
      width: rootConfig.width,
      height: rootConfig.height,
      children: [],
      level: 0
    }

    const contentNode = buildFlowTree(
      path, 
      0, 
      rootConfig.height / 2 + VERTICAL_SPACING, 
      1,
      rootNode
    )
    if (contentNode) {
      rootNode.children.push(contentNode)
    }

    const allNodes: FlowNode[] = []
    const traverse = (node: FlowNode) => {
      allNodes.push(node)
      node.children.forEach(traverse)
    }
    traverse(rootNode)

    return allNodes
  }

  const getAllConnections = (path: DecisionPath | undefined, allPaths: DecisionPath[]): Connection[] => {
    const nodes = getAllNodes(path, allPaths)
    const connections: Connection[] = []

    nodes.forEach(node => {
      node.children.forEach(child => {
        connections.push({
          from: node,
          to: child,
          label: child.conditionLabel
        })
      })
    })

    return connections
  }

  const handleNodeClick = (node: FlowNode, event: MouseEvent) => {
    if (event.detail === 2) {
      const container = containerRef.current
      if (!container) return
      
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      
      setIsAnimating(true)
      
      const rect = container.getBoundingClientRect()
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      
      const targetZoom = Math.min(zoom * 1.5, 3)
      
      const newPanX = centerX - node.x * targetZoom
      const newPanY = centerY - node.y * targetZoom
      
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
          animationFrameRef.current = requestAnimationFrame(animate)
        } else {
          animationFrameRef.current = null
          setIsAnimating(false)
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(animate)
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !selectedPath) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    
    ctx.scale(dpr, dpr)

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      ctx.save()
      ctx.translate(pan.x, pan.y)
      ctx.scale(zoom, zoom)

      const nodes = getAllNodes(selectedPath, paths)
      const connections = getAllConnections(selectedPath, paths)

      const centerOffsetX = rect.width / (2 * zoom) - pan.x / zoom
      const centerOffsetY = 50

      connections.forEach(conn => {
        drawConnection(ctx, conn, centerOffsetX, centerOffsetY)
      })

      nodes.forEach(node => {
        drawNode(ctx, node, centerOffsetX, centerOffsetY)
      })

      ctx.restore()
    }

    render()
  }, [selectedPath, paths, zoom, pan, hoveredNode, expandReferences])

  const drawConnection = (ctx: CanvasRenderingContext2D, conn: Connection, offsetX: number, offsetY: number) => {
    const fromX = conn.from.x + offsetX
    const fromY = conn.from.y + offsetY + conn.from.height / 2
    const toX = conn.to.x + offsetX
    const toY = conn.to.y + offsetY - conn.to.height / 2

    ctx.save()
    ctx.strokeStyle = 'oklch(0.55 0.10 220)'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'

    ctx.beginPath()
    ctx.moveTo(fromX, fromY)

    if (conn.from.type === 'decision' && conn.to.type === 'condition') {
      const controlPointOffset = Math.abs(toX - fromX) * 0.3
      ctx.bezierCurveTo(
        fromX, fromY + controlPointOffset,
        toX, toY - controlPointOffset,
        toX, toY
      )
    } else if (conn.from.type === 'condition') {
      ctx.bezierCurveTo(
        fromX, fromY + (toY - fromY) / 3,
        toX, toY - (toY - fromY) / 3,
        toX, toY
      )
    } else {
      ctx.bezierCurveTo(
        fromX, fromY + (toY - fromY) / 3,
        toX, toY - (toY - fromY) / 3,
        toX, toY
      )
    }
    
    ctx.stroke()
    ctx.restore()
  }

  const drawNode = (ctx: CanvasRenderingContext2D, node: FlowNode, offsetX: number, offsetY: number) => {
    const x = node.x + offsetX
    const y = node.y + offsetY
    const config = NODE_CONFIG[node.type]
    const isHovered = hoveredNode === node.id

    ctx.save()

    if (isHovered) {
      ctx.shadowColor = config.shadowColor
      ctx.shadowBlur = 20
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 4
    } else {
      ctx.shadowColor = config.shadowColor
      ctx.shadowBlur = 10
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 2
    }

    ctx.fillStyle = config.color
    ctx.strokeStyle = config.borderColor
    ctx.lineWidth = isHovered ? 4 : 3

    ctx.beginPath()
    ctx.roundRect(
      x - node.width / 2,
      y - node.height / 2,
      node.width,
      node.height,
      config.borderRadius
    )
    ctx.fill()
    ctx.stroke()

    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0

    ctx.fillStyle = config.textColor
    ctx.font = '600 14px Space Grotesk, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const maxWidth = node.width - 20
    const lines = wrapText(ctx, node.label, maxWidth)
    const lineHeight = 18
    const totalHeight = lines.length * lineHeight
    const startY = y - totalHeight / 2 + lineHeight / 2

    lines.forEach((line, i) => {
      ctx.fillText(line, x, startY + i * lineHeight)
    })

    if (node.type === 'path-reference') {
      ctx.font = '500 10px Inter, sans-serif'
      ctx.fillStyle = 'oklch(0.85 0 0)'
      ctx.fillText('→ Path Reference', x, y + node.height / 2 - 12)
    }

    ctx.restore()
  }

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''

    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const metrics = ctx.measureText(testLine)
      
      if (metrics.width <= maxWidth) {
        currentLine = testLine
      } else {
        if (currentLine) lines.push(currentLine)
        currentLine = word
      }
    })
    
    if (currentLine) lines.push(currentLine)
    
    return lines.slice(0, 3)
  }

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

  const handleExportPNG = () => {
    const canvas = canvasRef.current
    if (!canvas || !selectedPath) return

    const exportCanvas = document.createElement('canvas')
    const exportCtx = exportCanvas.getContext('2d')
    if (!exportCtx) return

    const nodes = getAllNodes(selectedPath, paths)
    
    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity
    
    nodes.forEach(node => {
      minX = Math.min(minX, node.x - node.width / 2)
      maxX = Math.max(maxX, node.x + node.width / 2)
      minY = Math.min(minY, node.y - node.height / 2)
      maxY = Math.max(maxY, node.y + node.height / 2)
    })

    const padding = 50
    const width = maxX - minX + padding * 2
    const height = maxY - minY + padding * 2

    exportCanvas.width = width
    exportCanvas.height = height

    exportCtx.fillStyle = 'oklch(0.98 0.005 250)'
    exportCtx.fillRect(0, 0, width, height)

    const offsetX = -minX + padding
    const offsetY = -minY + padding

    const connections = getAllConnections(selectedPath, paths)

    connections.forEach(conn => {
      drawConnection(exportCtx, conn, offsetX, offsetY)
    })

    nodes.forEach(node => {
      drawNode(exportCtx, node, offsetX, offsetY)
    })

    exportCanvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `flowchart-${selectedPath.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('Flowchart exported as PNG')
    })
  }

  const handleExportSVG = () => {
    if (!selectedPath) return

    const nodes = getAllNodes(selectedPath, paths)
    const connections = getAllConnections(selectedPath, paths)
    
    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity
    
    nodes.forEach(node => {
      minX = Math.min(minX, node.x - node.width / 2)
      maxX = Math.max(maxX, node.x + node.width / 2)
      minY = Math.min(minY, node.y - node.height / 2)
      maxY = Math.max(maxY, node.y + node.height / 2)
    })

    const padding = 50
    const width = maxX - minX + padding * 2
    const height = maxY - minY + padding * 2
    const offsetX = -minX + padding
    const offsetY = -minY + padding

    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600&amp;family=Inter:wght@500&amp;display=swap');
    </style>
  </defs>
  <rect width="100%" height="100%" fill="oklch(0.98 0.005 250)"/>
  <g id="connections">\n`

    connections.forEach(conn => {
      const fromX = conn.from.x + offsetX
      const fromY = conn.from.y + offsetY + conn.from.height / 2
      const toX = conn.to.x + offsetX
      const toY = conn.to.y + offsetY - conn.to.height / 2

      let path = `M ${fromX} ${fromY} `

      if (conn.from.type === 'decision' && conn.to.type === 'condition') {
        const controlPointOffset = Math.abs(toX - fromX) * 0.3
        path += `C ${fromX} ${fromY + controlPointOffset}, ${toX} ${toY - controlPointOffset}, ${toX} ${toY}`
      } else if (conn.from.type === 'condition') {
        path += `C ${fromX} ${fromY + (toY - fromY) / 3}, ${toX} ${toY - (toY - fromY) / 3}, ${toX} ${toY}`
      } else {
        path += `C ${fromX} ${fromY + (toY - fromY) / 3}, ${toX} ${toY - (toY - fromY) / 3}, ${toX} ${toY}`
      }

      svg += `    <path d="${path}" stroke="oklch(0.55 0.10 220)" stroke-width="3" fill="none" stroke-linecap="round"/>\n`
    })

    svg += `  </g>
  <g id="nodes">\n`

    nodes.forEach(node => {
      const x = node.x + offsetX
      const y = node.y + offsetY
      const config = NODE_CONFIG[node.type]

      const rectX = x - node.width / 2
      const rectY = y - node.height / 2

      svg += `    <g>
      <rect x="${rectX}" y="${rectY}" width="${node.width}" height="${node.height}" rx="${config.borderRadius}" 
            fill="${config.color}" stroke="${config.borderColor}" stroke-width="3"
            filter="drop-shadow(0 2px 10px ${config.shadowColor})"/>
      <text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" 
            fill="${config.textColor}" font-family="Space Grotesk, sans-serif" font-size="14" font-weight="600">\n`

      const maxWidth = node.width - 20
      const lines = wrapTextForSVG(node.label, maxWidth)
      const lineHeight = 18
      const totalHeight = lines.length * lineHeight
      const startY = y - totalHeight / 2 + lineHeight / 2

      lines.forEach((line, i) => {
        svg += `        <tspan x="${x}" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>\n`
      })

      svg += `      </text>\n`

      if (node.type === 'path-reference') {
        svg += `      <text x="${x}" y="${y + node.height / 2 - 12}" text-anchor="middle" 
              fill="oklch(0.85 0 0)" font-family="Inter, sans-serif" font-size="10" font-weight="500">→ Path Reference</text>\n`
      }

      svg += `    </g>\n`
    })

    svg += `  </g>
</svg>`

    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `flowchart-${selectedPath.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.svg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Flowchart exported as SVG')
  }

  const wrapTextForSVG = (text: string, maxWidth: number): string[] => {
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return [text]
    ctx.font = '600 14px Space Grotesk, sans-serif'

    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const metrics = ctx.measureText(testLine)
      
      if (metrics.width <= maxWidth) {
        currentLine = testLine
      } else {
        if (currentLine) lines.push(currentLine)
        currentLine = word
      }
    })
    
    if (currentLine) lines.push(currentLine)
    
    return lines.slice(0, 3)
  }

  const escapeXml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-full overflow-hidden bg-gradient-to-br from-background via-muted/30 to-accent/10 rounded-lg border relative cursor-grab"
    >
      <canvas ref={canvasRef} className="w-full h-full" />
      
      <div className="absolute top-4 left-4 flex items-center gap-3 bg-card/90 backdrop-blur-sm border rounded-lg px-4 py-2.5 shadow-lg">
        <Label htmlFor="expand-references" className="text-sm font-medium cursor-pointer">
          Expand References
        </Label>
        <Switch
          id="expand-references"
          checked={expandReferences}
          onCheckedChange={setExpandReferences}
        />
      </div>
      
      <div className="absolute top-4 right-4 flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="secondary"
              title="Export Flowchart"
              className="shadow-lg"
            >
              <Download />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportPNG}>
              <ImageIcon className="mr-2" />
              Export as PNG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportSVG}>
              <FileCode className="mr-2" />
              Export as SVG
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
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
