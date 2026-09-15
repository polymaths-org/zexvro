import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SmartContract, ContractFunction } from '../../types';
import { 
  Maximize2, 
  Minimize2, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Play, 
  Pause, 
  Layers, 
  Database, 
  Flame, 
  ShieldCheck, 
  ExternalLink,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface GraphNode {
  id: string;
  label: string;
  sublabel?: string;
  type: 'root' | 'function' | 'storage' | 'auth' | 'event';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  borderColor: string;
  fn?: ContractFunction;
  gasRating?: string;
  gasEstimate?: number;
  requiresAuth?: boolean;
}

interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  style?: 'solid' | 'dashed';
  color?: string;
}

interface Particle {
  edgeIndex: number;
  progress: number; // 0 to 1
  speed: number;
}

interface ContractGraphCanvasProps {
  contract: SmartContract;
  initialSelectedFn?: string;
  onSelectFunction?: (fnName: string) => void;
  height?: number | string;
  allowExpand?: boolean;
}

export const ContractGraphCanvas: React.FC<ContractGraphCanvasProps> = ({
  contract,
  initialSelectedFn,
  onSelectFunction,
  height = 360,
  allowExpand = true,
}) => {
  const { navigateToFunction, openAiExplain, openDryRun } = useApp();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<'flow' | 'storage' | 'gas'>('flow');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlayingParticles, setIsPlayingParticles] = useState(true);

  // Canvas Transform (Pan & Zoom)
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const offsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  offsetRef.current = offset;
  const scaleRef = useRef(1);
  scaleRef.current = scale;

  // Hover & Selection
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Layout Nodes & Edges based on viewMode and contract
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const particlesRef = useRef<Particle[]>([]);

  // Generate Graph Data
  useEffect(() => {
    const newNodes: GraphNode[] = [];
    const newEdges: GraphEdge[] = [];

    // Root Contract node at top center
    newNodes.push({
      id: 'root',
      label: contract.name,
      sublabel: `${contract.chain.toUpperCase()} • ${contract.language}`,
      type: 'root',
      x: 320,
      y: 40,
      width: 170,
      height: 48,
      color: '#161922',
      borderColor: '#3B82F6',
    });

    // Auth gatekeeper node
    newNodes.push({
      id: 'auth-gate',
      label: 'require_auth()',
      sublabel: 'Cryptographic Signature',
      type: 'auth',
      x: 90,
      y: 130,
      width: 150,
      height: 42,
      color: '#181C26',
      borderColor: '#2563EB',
    });
    newEdges.push({
      from: 'root',
      to: 'auth-gate',
      label: 'guards',
      style: 'dashed',
      color: '#3B82F6',
    });

    // Add function nodes
    const fns = contract.functions.slice(0, 6);
    const startX = 20;
    const spacingX = 145;
    const baseY = 210;

    fns.forEach((fn, idx) => {
      const nodeX = startX + idx * spacingX;
      const nodeY = baseY + (idx % 2 === 1 ? 25 : 0);

      let borderColor = '#2B2F3A';
      let nodeColor = '#14161E';

      if (viewMode === 'gas') {
        if (fn.gasRating === 'A+') {
          borderColor = '#22C55E';
          nodeColor = '#111D17';
        } else if (fn.gasRating === 'A') {
          borderColor = '#3B82F6';
          nodeColor = '#131A2A';
        } else {
          borderColor = '#F59E0B';
          nodeColor = '#211B14';
        }
      } else if (fn.requiresAuth) {
        borderColor = '#3B82F6';
      }

      newNodes.push({
        id: `fn-${fn.name}`,
        label: `fn ${fn.name}()`,
        sublabel: `${fn.gasEstimate.toLocaleString()} gas [${fn.gasRating}]`,
        type: 'function',
        x: nodeX,
        y: nodeY,
        width: 132,
        height: 52,
        color: nodeColor,
        borderColor: borderColor,
        fn,
        gasRating: fn.gasRating,
        gasEstimate: fn.gasEstimate,
        requiresAuth: fn.requiresAuth,
      });

      // Connect root to function
      newEdges.push({
        from: 'root',
        to: `fn-${fn.name}`,
        style: 'solid',
        color: '#2C303D',
      });

      // Connect auth-gate to functions requiring auth
      if (fn.requiresAuth) {
        newEdges.push({
          from: 'auth-gate',
          to: `fn-${fn.name}`,
          style: 'dashed',
          color: '#3B82F6',
        });
      }
    });

    // Storage Nodes at bottom
    if (viewMode === 'flow' || viewMode === 'storage') {
      const storageNodes = [
        { id: 'store-persistent', label: 'Persistent::Reserves', sublabel: 'TTL 30d • Auto-Bump', type: 'storage' as const, x: 120, y: 330 },
        { id: 'store-instance', label: 'Instance::ProtocolConfig', sublabel: 'Admin & Fee Rate', type: 'storage' as const, x: 340, y: 330 },
        { id: 'store-event', label: 'Event::SwapExecuted', sublabel: 'Topics [Token, Sender]', type: 'event' as const, x: 560, y: 330 },
      ];

      storageNodes.forEach((s) => {
        newNodes.push({
          id: s.id,
          label: s.label,
          sublabel: s.sublabel,
          type: s.type,
          x: s.x,
          y: s.y,
          width: 160,
          height: 46,
          color: s.type === 'event' ? '#14181D' : '#141B1F',
          borderColor: s.type === 'event' ? '#64748B' : '#0EA5E9',
        });
      });

      // Connect functions to storage
      fns.forEach((fn) => {
        if (fn.storageWrites > 0) {
          newEdges.push({
            from: `fn-${fn.name}`,
            to: 'store-persistent',
            style: 'solid',
            color: '#1E293B',
          });
        }
        if (fn.eventsEmitted && fn.eventsEmitted.length > 0) {
          newEdges.push({
            from: `fn-${fn.name}`,
            to: 'store-event',
            style: 'dashed',
            color: '#334155',
          });
        }
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);

    // Initialize particles on edges
    const pArr: Particle[] = [];
    for (let i = 0; i < newEdges.length * 2; i++) {
      pArr.push({
        edgeIndex: i % newEdges.length,
        progress: Math.random(),
        speed: 0.004 + Math.random() * 0.006,
      });
    }
    particlesRef.current = pArr;

    // Default select initial function if provided
    if (initialSelectedFn) {
      const target = newNodes.find((n) => n.fn?.name === initialSelectedFn);
      if (target) setSelectedNode(target);
    }
  }, [contract, viewMode, initialSelectedFn]);

  // Center the graph on initialization
  const fitToView = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setScale(0.95);
    setOffset({
      x: (rect.width - 800) / 2,
      y: 20,
    });
  }, []);

  useEffect(() => {
    fitToView();
  }, [fitToView]);

  // Animation Loop (requestAnimationFrame)
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Clear background with deep mono graphite
      ctx.fillStyle = '#0B0C0F';
      ctx.fillRect(0, 0, width, height);

      // 2. Draw subtle graphite grid dots
      ctx.fillStyle = '#1D2028';
      const gridSize = 24 * scaleRef.current;
      const startX = (offsetRef.current.x % gridSize);
      const startY = (offsetRef.current.y % gridSize);

      for (let x = startX; x < width; x += gridSize) {
        for (let y = startY; y < height; y += gridSize) {
          ctx.fillRect(x, y, 1.2, 1.2);
        }
      }

      // Apply transform for world space
      ctx.translate(offsetRef.current.x, offsetRef.current.y);
      ctx.scale(scaleRef.current, scaleRef.current);

      // 3. Draw Edges
      edges.forEach((edge) => {
        const fromNode = nodes.find((n) => n.id === edge.from);
        const toNode = nodes.find((n) => n.id === edge.to);
        if (!fromNode || !toNode) return;

        const startX = fromNode.x + fromNode.width / 2;
        const startY = fromNode.y + fromNode.height;
        const endX = toNode.x + toNode.width / 2;
        const endY = toNode.y;

        const isHighlighted =
          (selectedNode && (fromNode.id === selectedNode.id || toNode.id === selectedNode.id)) ||
          (hoveredNode && (fromNode.id === hoveredNode.id || toNode.id === hoveredNode.id));

        ctx.save();
        ctx.beginPath();
        if (edge.style === 'dashed') {
          ctx.setLineDash([4, 4]);
        }

        // Cubic bezier for natural tech graph curves
        const cp1Y = startY + (endY - startY) * 0.5;
        const cp2Y = startY + (endY - startY) * 0.5;

        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(startX, cp1Y, endX, cp2Y, endX, endY);

        ctx.strokeStyle = isHighlighted ? '#3B82F6' : (edge.color || '#242833');
        ctx.lineWidth = isHighlighted ? 2 : 1.2;
        ctx.stroke();
        ctx.restore();
      });

      // 4. Draw Animated Particles
      if (isPlayingParticles) {
        particlesRef.current.forEach((p) => {
          const edge = edges[p.edgeIndex];
          if (!edge) return;
          const fromNode = nodes.find((n) => n.id === edge.from);
          const toNode = nodes.find((n) => n.id === edge.to);
          if (!fromNode || !toNode) return;

          const startX = fromNode.x + fromNode.width / 2;
          const startY = fromNode.y + fromNode.height;
          const endX = toNode.x + toNode.width / 2;
          const endY = toNode.y;

          // Bezier point calculation
          const t = p.progress;
          const cp1Y = startY + (endY - startY) * 0.5;
          const cp2Y = startY + (endY - startY) * 0.5;

          const cx = 3 * (startX - startX);
          const bx = 3 * (endX - startX) - cx;
          const ax = endX - startX - cx - bx;

          // 1D bezier for Y
          const u = 1 - t;
          const px = u * u * u * startX + 3 * u * u * t * startX + 3 * u * t * t * endX + t * t * t * endX;
          const py = u * u * u * startY + 3 * u * u * t * cp1Y + 3 * u * t * t * cp2Y + t * t * t * endY;

          // Draw particle
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#60A5FA';
          ctx.shadowColor = '#3B82F6';
          ctx.shadowBlur = 4;
          ctx.fill();
          ctx.shadowBlur = 0;

          // Update progress
          p.progress += p.speed;
          if (p.progress > 1) {
            p.progress = 0;
          }
        });
      }

      // 5. Draw Nodes
      nodes.forEach((node) => {
        const isHovered = hoveredNode?.id === node.id;
        const isSelected = selectedNode?.id === node.id;

        // Rounded Box Path
        const radius = 6;
        ctx.beginPath();
        ctx.moveTo(node.x + radius, node.y);
        ctx.lineTo(node.x + node.width - radius, node.y);
        ctx.quadraticCurveTo(node.x + node.width, node.y, node.x + node.width, node.y + radius);
        ctx.lineTo(node.x + node.width, node.y + node.height - radius);
        ctx.quadraticCurveTo(node.x + node.width, node.y + node.height, node.x + node.width - radius, node.y + node.height);
        ctx.lineTo(node.x + radius, node.y + node.height);
        ctx.quadraticCurveTo(node.x, node.y + node.height, node.x, node.y + node.height - radius);
        ctx.lineTo(node.x, node.y + radius);
        ctx.quadraticCurveTo(node.x, node.y, node.x + radius, node.y);
        ctx.closePath();

        // Background fill
        ctx.fillStyle = isSelected ? '#1A2130' : (isHovered ? '#1A1D27' : node.color);
        ctx.fill();

        // Border stroke
        ctx.strokeStyle = isSelected ? '#3B82F6' : (isHovered ? '#60A5FA' : node.borderColor);
        ctx.lineWidth = isSelected ? 2 : (isHovered ? 1.5 : 1);
        ctx.stroke();

        // Glow if selected
        if (isSelected) {
          ctx.save();
          ctx.shadowColor = '#3B82F6';
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.restore();
        }

        // Text & Icons
        ctx.fillStyle = isSelected ? '#FFFFFF' : '#E2E5EC';
        ctx.font = '600 12px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(node.label, node.x + 10, node.y + 20);

        if (node.sublabel) {
          ctx.fillStyle = '#8E95A5';
          ctx.font = '400 10px Inter, sans-serif';
          ctx.fillText(node.sublabel, node.x + 10, node.y + 36);
        }

        // Indicator tag on right
        if (node.requiresAuth) {
          ctx.fillStyle = '#3B82F6';
          ctx.beginPath();
          ctx.arc(node.x + node.width - 12, node.y + 14, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [nodes, edges, isPlayingParticles, selectedNode, hoveredNode]);

  // Handle Mouse Events for Pan & Node Detection
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setMousePos({ x: e.clientX, y: e.clientY });

    if (isDragging) {
      setOffset({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
      return;
    }

    // World coordinates
    const worldX = (mouseX - offset.x) / scale;
    const worldY = (mouseY - offset.y) / scale;

    // Check node under cursor
    const found = nodes.find(
      (n) =>
        worldX >= n.x &&
        worldX <= n.x + n.width &&
        worldY >= n.y &&
        worldY <= n.y + n.height
    );

    setHoveredNode(found || null);
    canvas.style.cursor = found ? 'pointer' : (isDragging ? 'grabbing' : 'grab');
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX - offset.x) / scale;
    const worldY = (mouseY - offset.y) / scale;

    const clicked = nodes.find(
      (n) =>
        worldX >= n.x &&
        worldX <= n.x + n.width &&
        worldY >= n.y &&
        worldY <= n.y + n.height
    );

    if (clicked) {
      setSelectedNode(clicked);
      if (clicked.fn && onSelectFunction) {
        onSelectFunction(clicked.fn.name);
      }
    } else {
      setSelectedNode(null);
    }
  };

  // Zoom controls
  const handleZoom = (factor: number) => {
    setScale((prev) => Math.max(0.4, Math.min(2.2, prev * factor)));
  };

  return (
    <div
      ref={containerRef}
      className={`relative rounded-[8px] border border-[#23252B] bg-[#0B0C0F] overflow-hidden transition-all flex flex-col ${
        isExpanded
          ? 'fixed inset-4 z-50 shadow-2xl bg-[#090A0D]'
          : 'w-full'
      }`}
      style={{ height: isExpanded ? 'calc(100vh - 32px)' : height }}
    >
      {/* Top Controls Toolbar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#23252B] bg-[#111318] select-none text-xs z-10">
        <div className="flex items-center gap-2">
          {/* View mode switcher */}
          <div className="flex items-center bg-[#171A21] p-0.5 rounded-[6px] border border-[#282C37]">
            <button
              type="button"
              onClick={() => setViewMode('flow')}
              className={`px-2.5 py-1 rounded-[4px] text-xs font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'flow'
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[#8E95A5] hover:text-[#FAFAFA]'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>AST Call Flow</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('storage')}
              className={`px-2.5 py-1 rounded-[4px] text-xs font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'storage'
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[#8E95A5] hover:text-[#FAFAFA]'
              }`}
            >
              <Database className="w-3 h-3" />
              <span>Ledger Storage</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('gas')}
              className={`px-2.5 py-1 rounded-[4px] text-xs font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'gas'
                  ? 'bg-[#2563EB] text-white'
                  : 'text-[#8E95A5] hover:text-[#FAFAFA]'
              }`}
            >
              <Flame className="w-3 h-3" />
              <span>Gas Heatmap</span>
            </button>
          </div>

          <span className="hidden sm:inline-block text-[11px] text-[#6C7280]">
            Interactive Canvas • Pan & Zoom
          </span>
        </div>

        {/* Right Toolbar Actions */}
        <div className="flex items-center gap-1 text-[#8E95A5]">
          <button
            type="button"
            onClick={() => setIsPlayingParticles(!isPlayingParticles)}
            className="p-1.5 rounded hover:bg-[#1C1F27] hover:text-[#FAFAFA] transition-colors"
            title={isPlayingParticles ? 'Pause Particle Flow' : 'Play Particle Flow'}
          >
            {isPlayingParticles ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <div className="w-[1px] h-3.5 bg-[#262A35] mx-1" />

          <button
            type="button"
            onClick={() => handleZoom(1.15)}
            className="p-1.5 rounded hover:bg-[#1C1F27] hover:text-[#FAFAFA] transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => handleZoom(0.85)}
            className="p-1.5 rounded hover:bg-[#1C1F27] hover:text-[#FAFAFA] transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={fitToView}
            className="p-1.5 rounded hover:bg-[#1C1F27] hover:text-[#FAFAFA] transition-colors"
            title="Reset View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {allowExpand && (
            <>
              <div className="w-[1px] h-3.5 bg-[#262A35] mx-1" />
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded hover:bg-[#1C1F27] hover:text-[#FAFAFA] transition-colors"
                title={isExpanded ? 'Collapse' : 'Expand Fullscreen'}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
          className="w-full h-full block"
        />

        {/* Floating Quick Inspector Card when a node is selected */}
        {selectedNode && selectedNode.fn && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-96 p-3.5 rounded-[8px] border border-[#2D323E] bg-[#12141A]/95 backdrop-blur-md shadow-2xl space-y-2 z-20 text-xs">
            <div className="flex items-start justify-between gap-2 border-b border-[#232733] pb-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#FAFAFA] text-sm">
                    fn {selectedNode.fn.name}()
                  </span>
                  {selectedNode.fn.requiresAuth && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-[9999px] bg-[#3B82F6]/15 text-[#93C5FD] border border-[#3B82F6]/30">
                      <ShieldCheck className="w-3 h-3 text-[#3B82F6]" />
                      Auth
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#8E95A5] line-clamp-1 mt-0.5">
                  {selectedNode.fn.docExcerpt}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="text-[#6C7280] hover:text-[#FAFAFA] text-sm leading-none"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] py-1">
              <div className="p-1.5 rounded bg-[#171922] border border-[#242835]">
                <span className="text-[#6C7280] block">Gas Rating:</span>
                <span className="font-semibold text-[#60A5FA]">
                  {selectedNode.fn.gasEstimate.toLocaleString()} [{selectedNode.fn.gasRating}]
                </span>
              </div>
              <div className="p-1.5 rounded bg-[#171922] border border-[#242835]">
                <span className="text-[#6C7280] block">Storage State:</span>
                <span className="text-[#E2E5EC]">
                  {selectedNode.fn.storageWrites} writes / {selectedNode.fn.storageReads} reads
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 pt-1 border-t border-[#232733]">
              <button
                type="button"
                onClick={() => navigateToFunction(contract.chain, contract.contractId, selectedNode.fn!.name)}
                className="flex-1 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium flex items-center justify-center gap-1 transition-colors"
              >
                <span>Deep Read</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => openDryRun(contract, selectedNode.fn!)}
                className="px-2.5 py-1.5 rounded bg-[#181B23] hover:bg-[#20242F] border border-[#282C37] text-[#FAFAFA] font-medium transition-colors"
                title="Simulate Invocations"
              >
                Dry-Run
              </button>

              <button
                type="button"
                onClick={() => openAiExplain(contract, selectedNode.fn!)}
                className="p-1.5 rounded bg-[#181B23] hover:bg-[#20242F] border border-[#282C37] text-[#60A5FA] transition-colors"
                title="Explain with AI"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Instruction Footer pill */}
        <div className="absolute bottom-2.5 right-2.5 px-2 py-1 rounded-[4px] bg-[#12141A]/80 border border-[#232733] text-[10px] text-[#6C7280] pointer-events-none">
          Click any node to inspect • Drag to pan
        </div>
      </div>
    </div>
  );
};
