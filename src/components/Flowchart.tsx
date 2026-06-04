import { DecisionPath, TreeNode, DecisionNode, ConditionNode, OutcomeStatus } from '@/lib/types'
import { useEffect, useRef, useState, useMemo } from 'react'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import { Label } from './ui/label'
import { Plus, Minus, ArrowsOut, Image as ImageIcon, FileCode, Download, Copy, FrameCorners } from '@phosphor-icons/react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { collectNotedNodes } from '@/lib/tree-utils'

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
  outcomeType?: OutcomeStatus
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

const OUTCOME_CONFIG = {
  success: NODE_CONFIG.outcome,
  fail: {
    width: 180,
    height: 70,
    color: 'oklch(0.62 0.20 25)',
    borderColor: 'oklch(0.44 0.20 25)',
    textColor: 'oklch(0.98 0 0)',
    borderRadius: 35,
    shadowColor: 'oklch(0.44 0.20 25 / 0.3)',
  },
  neutral: {
    width: 180,
    height: 70,
    color: 'oklch(0.58 0.10 235)',
    borderColor: 'oklch(0.38 0.12 235)',
    textColor: 'oklch(0.98 0 0)',
    borderRadius: 35,
    shadowColor: 'oklch(0.38 0.12 235 / 0.3)',
  },
}

const HORIZONTAL_SPACING = 160
const VERTICAL_SPACING = 140
const CONDITION_VERTICAL_OFFSET = 80
const ZOOM_IN_FACTOR = 1.1
const ZOOM_OUT_FACTOR = 0.9
const NODE_TEXT_FONT = '600 14px Space Grotesk, sans-serif'
const NODE_TEXT_LINE_HEIGHT = 18
const NODE_HORIZONTAL_PADDING = 14
const NODE_VERTICAL_PADDING = 12
const PATH_REFERENCE_SUBTITLE_HEIGHT = 14

const NODE_MAX_TEXT_WIDTH: Record<FlowNode['type'], number> = {
  decision: 320,
  outcome: 300,
  'path-reference': 300,
  condition: 260,
  root: 340,
}

export function Flowchart({ paths, selectedPathId }: FlowchartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const measureCanvasRef = useRef<HTMLCanvasElement | null>(null)
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

  const notedNodes = useMemo(() => {
    if (!selectedPath) return [] as { id: string; note: string; citation: number }[]
    return collectNotedNodes(selectedPath).map((item, i) => ({
      ...item,
      citation: i + 1,
    }))
  }, [selectedPath])

  const flowCitationMap = useMemo(() => {
    const map = new Map<string, number>()
    notedNodes.forEach(item => map.set(item.id, item.citation))
    return map
  }, [notedNodes])

  const pathNote = selectedPath?.pathNote?.trim() || ''

  const appendCitation = (label: string, nodeId: string) => {
    const citation = flowCitationMap.get(nodeId)
    return citation ? `${label} (${citation})` : label
  }

  const getOutcomeConfig = (outcomeType?: OutcomeStatus) => {
    return OUTCOME_CONFIG[outcomeType || 'neutral']
  }

  const getStyleConfigByType = (type: FlowNode['type'], outcomeType?: OutcomeStatus) => {
    if (type === 'outcome') {
      return getOutcomeConfig(outcomeType)
    }
    return NODE_CONFIG[type]
  }

  const getTreeNodeLabel = (node: TreeNode | DecisionPath) => {
    if (node.type === 'path-reference') {
      const referencedPath = paths.find(p => p.id === node.pathId)
      return appendCitation(referencedPath?.name || 'Unknown Path', node.id)
    }

    return appendCitation(node.description, node.id)
  }

  const getMeasureContext = () => {
    if (!measureCanvasRef.current) {
      measureCanvasRef.current = document.createElement('canvas')
    }
    return measureCanvasRef.current.getContext('2d')
  }

  const getWrappedLinesForMeasurement = (text: string, maxWidth: number) => {
    const ctx = getMeasureContext()
    if (!ctx) return [text]

    ctx.font = NODE_TEXT_FONT
    const paragraphs = text.replace(/\r\n?/g, '\n').split('\n')
    const lines: string[] = []

    paragraphs.forEach(paragraph => {
      if (paragraph.trim().length === 0) {
        lines.push('')
        return
      }

      const words = paragraph.split(/\s+/)
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
    })

    return lines.length > 0 ? lines : ['']
  }

  const getNodeDimensions = (type: FlowNode['type'], label: string, outcomeType?: OutcomeStatus) => {
    const config = getStyleConfigByType(type, outcomeType)
    const maxTextWidth = NODE_MAX_TEXT_WIDTH[type]
    const lines = getWrappedLinesForMeasurement(label, maxTextWidth)
    const ctx = getMeasureContext()

    let longestLineWidth = 0
    if (ctx) {
      ctx.font = NODE_TEXT_FONT
      lines.forEach(line => {
        longestLineWidth = Math.max(longestLineWidth, ctx.measureText(line).width)
      })
    }

    const subtitleHeight = type === 'path-reference' ? PATH_REFERENCE_SUBTITLE_HEIGHT : 0

    const width = Math.max(
      config.width,
      Math.ceil(longestLineWidth + NODE_HORIZONTAL_PADDING * 2)
    )
    const height = Math.max(
      config.height,
      Math.ceil(lines.length * NODE_TEXT_LINE_HEIGHT + NODE_VERTICAL_PADDING * 2 + subtitleHeight)
    )

    return { width, height }
  }

  const getFlowNodeConfig = (node: FlowNode) => {
    return getStyleConfigByType(node.type, node.outcomeType)
  }

  const resolveTreeNode = (
    node: TreeNode | DecisionPath,
    visitedPaths: Set<string>
  ): { node: TreeNode | DecisionPath; visitedPaths: Set<string> } | null => {
    if (node.type !== 'path-reference' || !expandReferences) {
      return { node, visitedPaths }
    }

    const referencedPath = paths.find(p => p.id === node.pathId)
    if (!referencedPath || visitedPaths.has(node.pathId)) {
      return null
    }

    const nextVisitedPaths = new Set(visitedPaths)
    nextVisitedPaths.add(node.pathId)

    return {
      node: referencedPath,
      visitedPaths: nextVisitedPaths,
    }
  }

  const measureSubtreeWidth = (
    node: TreeNode | DecisionPath,
    visitedPaths: Set<string> = new Set()
  ): number => {
    const resolved = resolveTreeNode(node, visitedPaths)
    if (!resolved) return 0

    const currentNode = resolved.node
    const nodeLabel = getTreeNodeLabel(currentNode)
    const nodeDimensions = getNodeDimensions(
      currentNode.type,
      nodeLabel,
      currentNode.type === 'outcome' ? (currentNode.outcomeType || 'neutral') : undefined
    )

    if (currentNode.type === 'decision' && currentNode.conditions && currentNode.conditions.length > 0) {
      const childWidths = currentNode.conditions.map(condition => measureSubtreeWidth(condition, resolved.visitedPaths))
      const childrenWidth = childWidths.reduce((sum, width) => sum + width, 0) + (childWidths.length - 1) * HORIZONTAL_SPACING
      return Math.max(nodeDimensions.width, childrenWidth)
    }

    if (currentNode.type === 'condition' && currentNode.next) {
      return Math.max(nodeDimensions.width, measureSubtreeWidth(currentNode.next, resolved.visitedPaths))
    }

    return nodeDimensions.width
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      // Keep pinch/wheel zoom behavior identical to +/- button zoom behavior.
      setZoom(prev => Math.min(Math.max(prev * (e.deltaY > 0 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR), 0.1), 5))
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
        const centerOffsetX = rect.width / (2 * zoom)
        const centerOffsetY = 50
        const mouseX = (e.clientX - rect.left - pan.x) / zoom - centerOffsetX
        const mouseY = (e.clientY - rect.top - pan.y) / zoom - centerOffsetY
        
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
      const centerOffsetX = rect.width / (2 * zoom)
      const centerOffsetY = 50
      const mouseX = (e.clientX - rect.left - pan.x) / zoom - centerOffsetX
      const mouseY = (e.clientY - rect.top - pan.y) / zoom - centerOffsetY
      
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

  const buildFlowTree = (
    node: TreeNode | DecisionPath,
    x: number,
    y: number,
    level: number,
    parent?: FlowNode,
    visitedPaths: Set<string> = new Set()
  ): FlowNode | null => {
    const resolved = resolveTreeNode(node, visitedPaths)
    if (!resolved) return null

    const currentNode = resolved.node
    const nodeLabel = getTreeNodeLabel(currentNode)
    const outcomeType = currentNode.type === 'outcome' ? (currentNode.outcomeType || 'neutral') : undefined
    const nodeDimensions = getNodeDimensions(currentNode.type, nodeLabel, outcomeType)
    
    const flowNode: FlowNode = {
      id: currentNode.id,
      type: currentNode.type,
      label: nodeLabel,
      x,
      y,
      width: nodeDimensions.width,
      height: nodeDimensions.height,
      pathId: node.type === 'path-reference' ? node.pathId : undefined,
      children: [],
      parent,
      level,
      outcomeType
    }

    if (currentNode.type === 'decision') {
      if (currentNode.conditions && currentNode.conditions.length > 0) {
        const childWidths = currentNode.conditions.map(condition => measureSubtreeWidth(condition, resolved.visitedPaths))
        const totalWidth = childWidths.reduce((sum, width) => sum + width, 0) + (childWidths.length - 1) * HORIZONTAL_SPACING
        let currentX = x - totalWidth / 2

        currentNode.conditions.forEach((condition, index) => {
          const childWidth = childWidths[index]
          const childX = currentX + childWidth / 2
          const childY = y + flowNode.height / 2 + CONDITION_VERTICAL_OFFSET
          
          const conditionNode = buildFlowTree(condition, childX, childY, level + 1, flowNode, resolved.visitedPaths)
          if (conditionNode) {
            conditionNode.conditionLabel = condition.description
            flowNode.children.push(conditionNode)
          }

          currentX += childWidth + HORIZONTAL_SPACING
        })
      }
    } else if (currentNode.type === 'condition') {
      if (currentNode.next) {
        const nextY = y + flowNode.height / 2 + VERTICAL_SPACING
        const nextNode = buildFlowTree(currentNode.next, x, nextY, level + 1, flowNode, resolved.visitedPaths)
        if (nextNode) {
          flowNode.children.push(nextNode)
        }
      }
    }

    return flowNode
  }

  const getAllNodes = (path: DecisionPath | undefined, allPaths: DecisionPath[]): FlowNode[] => {
    if (!path) return []
    
    const rootDimensions = getNodeDimensions('root', path.name)
    const rootNode: FlowNode = {
      id: 'root',
      type: 'root',
      label: path.name,
      x: 0,
      y: 0,
      width: rootDimensions.width,
      height: rootDimensions.height,
      children: [],
      level: 0
    }

    const contentNode = buildFlowTree(
      path, 
      0, 
      rootNode.height / 2 + VERTICAL_SPACING, 
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

      const centerOffsetX = rect.width / (2 * zoom)
      const centerOffsetY = 50

      connections.forEach(conn => {
        drawConnection(ctx, conn, centerOffsetX, centerOffsetY)
      })

      nodes.forEach(node => {
        drawNode(ctx, node, centerOffsetX, centerOffsetY)
      })

      ctx.restore()

      if (pathNote || notedNodes.length > 0) {
        const panelWidth = Math.min(rect.width - 32, 720)
        const panelX = 16
        const panelHeight = getFootnotePanelHeight(ctx, panelWidth - 24)
        const panelY = Math.max(16, rect.height - panelHeight - 16)
        drawFootnotesPanel(ctx, panelX, panelY, panelWidth, panelWidth - 24)
      }
    }

    render()
  }, [selectedPath, paths, zoom, pan, hoveredNode, expandReferences, notedNodes, flowCitationMap, pathNote])

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
    const config = getFlowNodeConfig(node)
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
    ctx.font = NODE_TEXT_FONT
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const maxWidth = node.width - NODE_HORIZONTAL_PADDING * 2
    const lines = wrapText(ctx, node.label, maxWidth, Number.POSITIVE_INFINITY)
    const lineHeight = NODE_TEXT_LINE_HEIGHT
    const totalHeight = lines.length * lineHeight
    const textCenterY = node.type === 'path-reference'
      ? y - PATH_REFERENCE_SUBTITLE_HEIGHT / 2
      : y
    const startY = textCenterY - totalHeight / 2 + lineHeight / 2

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

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 3): string[] => {
    const paragraphs = text.replace(/\r\n?/g, '\n').split('\n')
    const lines: string[] = []

    paragraphs.forEach(paragraph => {
      if (paragraph.trim().length === 0) {
        lines.push('')
        return
      }

      const words = paragraph.split(/\s+/)
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
    })

    return Number.isFinite(maxLines) ? lines.slice(0, maxLines) : lines
  }

  const getFootnoteRenderLines = (ctx: CanvasRenderingContext2D, maxTextWidth: number): string[] => {
    const lines: string[] = ['Notes']

    if (pathNote) {
      lines.push(...wrapText(ctx, pathNote, maxTextWidth, Number.POSITIVE_INFINITY))
    }

    if (pathNote && notedNodes.length > 0) {
      lines.push('')
    }

    notedNodes.forEach((item) => {
      const wrapped = wrapText(ctx, `(${item.citation}) ${item.note}`, maxTextWidth, Number.POSITIVE_INFINITY)
      lines.push(...wrapped)
    })

    return lines
  }

  const getFootnotePanelHeight = (ctx: CanvasRenderingContext2D, maxTextWidth: number): number => {
    if (notedNodes.length === 0 && !pathNote) return 0

    const lines = getFootnoteRenderLines(ctx, maxTextWidth)
    const lineHeight = 17
    return 16 + lines.length * lineHeight + 12
  }

  const drawFootnotesPanel = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    panelWidth: number,
    maxTextWidth: number
  ) => {
    if (notedNodes.length === 0 && !pathNote) return

    const lines = getFootnoteRenderLines(ctx, maxTextWidth)
    const lineHeight = 17
    const panelHeight = getFootnotePanelHeight(ctx, maxTextWidth)

    ctx.save()

    ctx.fillStyle = 'oklch(0.98 0.005 250 / 0.92)'
    ctx.strokeStyle = 'oklch(0.70 0.10 70 / 0.8)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(x, y, panelWidth, panelHeight, 8)
    ctx.fill()
    ctx.stroke()

    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    let cursorY = y + 10
    lines.forEach((line, index) => {
      if (index === 0) {
        ctx.fillStyle = 'oklch(0.40 0.10 70)'
        ctx.font = '700 12px Space Grotesk, sans-serif'
      } else {
        ctx.fillStyle = 'oklch(0.30 0.03 260)'
        ctx.font = '500 12px Inter, sans-serif'
      }
      ctx.fillText(line, x + 12, cursorY)
      cursorY += lineHeight
    })

    ctx.restore()
  }

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * ZOOM_IN_FACTOR, 5))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev * ZOOM_OUT_FACTOR, 0.1))
  }

  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const handleZoomToFit = () => {
    const container = containerRef.current
    if (!container || !selectedPath) return

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    const nodes = getAllNodes(selectedPath, paths)
    if (nodes.length === 0) return

    const rect = container.getBoundingClientRect()

    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity

    nodes.forEach(node => {
      minX = Math.min(minX, node.x - node.width / 2)
      maxX = Math.max(maxX, node.x + node.width / 2)
      minY = Math.min(minY, node.y - node.height / 2)
      maxY = Math.max(maxY, node.y + node.height / 2)
    })

    const contentWidth = maxX - minX
    const contentHeight = maxY - minY
    
    const padding = 80
    const scaleX = (rect.width - padding * 2) / contentWidth
    const scaleY = (rect.height - padding * 2) / contentHeight
    const targetZoom = Math.min(scaleX, scaleY, 2)

    const contentCenterX = (minX + maxX) / 2
    const contentCenterY = (minY + maxY) / 2
    
    const viewCenterX = rect.width / (2 * targetZoom)
    const viewCenterY = rect.height / (2 * targetZoom)
    
    const newPanX = (viewCenterX - contentCenterX) * targetZoom
    const newPanY = (viewCenterY - contentCenterY) * targetZoom

    setIsAnimating(true)
    
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
    const contentWidth = maxX - minX + padding * 2
    const contentHeight = maxY - minY + padding * 2
    const footnotesHeight = getFootnotePanelHeight(exportCtx, contentWidth - 24)
    const width = contentWidth
    const height = contentHeight + (footnotesHeight > 0 ? footnotesHeight + 16 : 0)

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

    if (footnotesHeight > 0) {
      drawFootnotesPanel(exportCtx, 12, contentHeight + 8, contentWidth - 24, contentWidth - 48)
    }

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

  const handleCopyToClipboard = async () => {
    const canvas = canvasRef.current
    if (!canvas || !selectedPath) return

    try {
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
      const contentWidth = maxX - minX + padding * 2
      const contentHeight = maxY - minY + padding * 2
      const footnotesHeight = getFootnotePanelHeight(exportCtx, contentWidth - 24)
      const width = contentWidth
      const height = contentHeight + (footnotesHeight > 0 ? footnotesHeight + 16 : 0)

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

      if (footnotesHeight > 0) {
        drawFootnotesPanel(exportCtx, 12, contentHeight + 8, contentWidth - 24, contentWidth - 48)
      }

      exportCanvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error('Failed to generate image')
          return
        }
        
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob
            })
          ])
          toast.success('Flowchart copied to clipboard')
        } catch (err) {
          toast.error('Failed to copy to clipboard')
        }
      })
    } catch (error) {
      toast.error('Failed to copy flowchart')
    }
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
    const contentWidth = maxX - minX + padding * 2
    const contentHeight = maxY - minY + padding * 2
    const notesLines: string[] = ['Notes']
    if (pathNote) {
      notesLines.push(...wrapTextForSVG(pathNote, contentWidth - 24, Number.POSITIVE_INFINITY))
    }
    if (pathNote && notedNodes.length > 0) {
      notesLines.push('')
    }
    notedNodes.forEach((item) => {
      notesLines.push(...wrapTextForSVG(`(${item.citation}) ${item.note}`, contentWidth - 24, Number.POSITIVE_INFINITY))
    })
    const notesLineHeight = 17
    const notesBlockHeight = (pathNote || notedNodes.length > 0) ? 16 + notesLines.length * notesLineHeight + 12 : 0
    const width = contentWidth
    const height = contentHeight + (notesBlockHeight > 0 ? notesBlockHeight + 16 : 0)
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
      const config = getFlowNodeConfig(node)

      const rectX = x - node.width / 2
      const rectY = y - node.height / 2

      svg += `    <g>
      <rect x="${rectX}" y="${rectY}" width="${node.width}" height="${node.height}" rx="${config.borderRadius}" 
            fill="${config.color}" stroke="${config.borderColor}" stroke-width="3"
            filter="drop-shadow(0 2px 10px ${config.shadowColor})"/>
      <text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" 
            fill="${config.textColor}" font-family="Space Grotesk, sans-serif" font-size="14" font-weight="600">\n`

      const maxWidth = node.width - NODE_HORIZONTAL_PADDING * 2
      const lines = wrapTextForSVG(node.label, maxWidth, Number.POSITIVE_INFINITY)
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
`

    if (notesBlockHeight > 0) {
      const notesY = contentHeight + 8
      svg += `  <g id="footnotes">
    <rect x="12" y="${notesY}" width="${contentWidth - 24}" height="${notesBlockHeight}" rx="8" fill="oklch(0.98 0.005 250 / 0.92)" stroke="oklch(0.70 0.10 70 / 0.8)" stroke-width="1.5"/>
`
      let lineY = notesY + 10
      notesLines.forEach((line, index) => {
        const color = index === 0 ? 'oklch(0.40 0.10 70)' : 'oklch(0.30 0.03 260)'
        const family = index === 0 ? 'Space Grotesk, sans-serif' : 'Inter, sans-serif'
        const weight = index === 0 ? '700' : '500'
        svg += `    <text x="24" y="${lineY}" fill="${color}" font-family="${family}" font-size="12" font-weight="${weight}" dominant-baseline="hanging">${escapeXml(line)}</text>
`
        lineY += notesLineHeight
      })
      svg += `  </g>
`
    }

    svg += `</svg>`

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

  const wrapTextForSVG = (text: string, maxWidth: number, maxLines = 3): string[] => {
    const paragraphs = text.replace(/\r\n?/g, '\n').split('\n')
    const lines: string[] = []

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return [text]
    ctx.font = NODE_TEXT_FONT

    paragraphs.forEach(paragraph => {
      if (paragraph.trim().length === 0) {
        lines.push('')
        return
      }

      const words = paragraph.split(/\s+/)
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
    })

    return Number.isFinite(maxLines) ? lines.slice(0, maxLines) : lines
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
            <DropdownMenuItem onClick={handleCopyToClipboard}>
              <Copy className="mr-2" />
              Copy to Clipboard
            </DropdownMenuItem>
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
          onClick={handleZoomToFit}
          title="Zoom to Fit"
          className="shadow-lg"
        >
          <FrameCorners weight="bold" />
          Fit
        </Button>
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
