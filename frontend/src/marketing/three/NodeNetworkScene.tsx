import { Line } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { networkEdges, networkNodes } from './nodeNetworkConfig';

function NetworkMesh() {
  const groupRef = useRef<Group>(null);
  const nodeMap = useMemo(() => new Map(networkNodes.map(node => [node.id, node])), []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const elapsed = clock.getElapsedTime();
    groupRef.current.rotation.y = Math.sin(elapsed * 0.08) * 0.12;
    groupRef.current.rotation.x = Math.cos(elapsed * 0.06) * 0.05;
  });

  return (
    <group ref={groupRef}>
      {networkEdges.map(([fromId, toId]) => {
        const from = nodeMap.get(fromId);
        const to = nodeMap.get(toId);
        if (!from || !to) return null;
        return (
          <Line
            key={`${fromId}-${toId}`}
            points={[from.position, to.position]}
            color="#FAFAFA"
            opacity={0.23}
            transparent
            lineWidth={1}
          />
        );
      })}

      {networkNodes.map(node => (
        <mesh key={node.id} position={node.position}>
          <boxGeometry args={[node.size, node.size, node.size]} />
          <meshBasicMaterial color="#FAFAFA" transparent opacity={node.id === 'core' ? 0.72 : 0.46} />
        </mesh>
      ))}
    </group>
  );
}

export default function NodeNetworkScene() {
  const dpr = typeof window === 'undefined'
    ? 1
    : Math.min(window.devicePixelRatio || 1, 1.5);

  return (
    <Canvas
      className="marketing-node-canvas"
      camera={{ position: [0, 0, 4.2], fov: 42 }}
      dpr={dpr}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <NetworkMesh />
    </Canvas>
  );
}
