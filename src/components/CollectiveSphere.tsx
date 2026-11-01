import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html, Text } from '@react-three/drei';
import { useStore } from '../store';

// Helper to distribute points on a sphere (Fibonacci sphere)
function getFibonacciSpherePoints(samples: number, radius: number) {
  const points = [];
  const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle in radians
  for (let i = 0; i < samples; i++) {
    const y = 1 - (i / (samples - 1)) * 2; // y goes from 1 to -1
    const r = Math.sqrt(1 - y * y); // radius at y

    const theta = phi * i; // golden angle increment

    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;

    points.push(new THREE.Vector3(x * radius, y * radius, z * radius));
  }
  return points;
}

const StarAgent = ({
  position,
  agentId,
  isActive,
  isSelected,
  isOrchestrator,
  isSpecialist,
  agentName,
  onClick,
  activeColor,
  selectedColor,
  cognitiveLoop
}: {
  position: THREE.Vector3;
  agentId: number;
  isActive: boolean;
  isSelected: boolean;
  isOrchestrator: boolean;
  isSpecialist: boolean;
  agentName: string;
  onClick: () => void;
  activeColor: string;
  selectedColor: string;
  cognitiveLoop: boolean;
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      // Rotation
      meshRef.current.rotation.x += 0.01;
      meshRef.current.rotation.y += 0.01;
      
      // Pulse logic
      let baseScale = isOrchestrator ? 1.4 : (isSpecialist ? 1.25 : 1);
      
      if (isOrchestrator) {
        const pulse = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.15;
        meshRef.current.scale.set(baseScale * pulse, baseScale * pulse, baseScale * pulse);
      } else if (isSpecialist) {
        const pulse = 1 + Math.sin(state.clock.elapsedTime * 6 + agentId) * 0.2;
        meshRef.current.scale.set(baseScale * pulse, baseScale * pulse, baseScale * pulse);
      } else if (isActive) {
        let pulseSpeed = 3;
        let phase = agentId;
        
        if (cognitiveLoop) {
          pulseSpeed = 8;
          const isGroupA = agentId < 200;
          phase = isGroupA ? 0 : Math.PI; 
        }
        
        const scale = 1 + Math.sin(state.clock.elapsedTime * pulseSpeed + phase) * (cognitiveLoop ? 0.3 : 0.1);
        meshRef.current.scale.set(scale, scale, scale);
      } else {
        meshRef.current.scale.set(baseScale, baseScale, baseScale);
      }
    }
  });

  const isCouncil = agentId >= 1 && agentId <= 9;
  const isDesktopBridge = agentId === 390;
  const designatedSpeakerId = useStore((state) => state.designatedSpeakerId);
  const isSpeaker = agentId === designatedSpeakerId;

  let displayColor = isSelected ? selectedColor : (isActive ? activeColor : '#334155');
  let emissiveColor = isSelected ? selectedColor : (isActive ? activeColor : '#000000');
  let emissiveIntensity = isActive ? 1 : 0;

  if (isOrchestrator) {
    displayColor = '#fbbf24'; // Amber Gold
    emissiveColor = '#f59e0b';
    emissiveIntensity = 2.2;
  } else if (isSpeaker) {
    displayColor = '#f59e0b'; // Amber Gold Speaker
    emissiveColor = '#d97706';
    emissiveIntensity = 2.4;
  } else if (isSpecialist) {
    displayColor = '#10b981'; // Vivid Emerald Green
    emissiveColor = '#059669';
    emissiveIntensity = 2.0;
  } else if (isDesktopBridge) {
    displayColor = '#06b6d4'; // Cyan Desktop Bridge
    emissiveColor = '#0891b2';
    emissiveIntensity = 1.8;
  } else if (isCouncil) {
    displayColor = '#38bdf8'; // Sky Blue Council
    emissiveColor = '#0284c7';
    emissiveIntensity = 1.4;
  } else if (cognitiveLoop && isActive) {
    const isGroupA = agentId < 200;
    displayColor = isGroupA ? '#ff00aa' : '#00ffaa';
    emissiveColor = displayColor;
    emissiveIntensity = 1.5;
  }

  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[isOrchestrator ? 0.7 : (isCouncil || isDesktopBridge ? 0.55 : 0.45), 0]} />
        <meshStandardMaterial 
          color={displayColor} 
          emissive={emissiveColor} 
          emissiveIntensity={emissiveIntensity}
          wireframe={!isActive && !isOrchestrator && !isSpecialist && !isCouncil && !isDesktopBridge}
        />
      </mesh>
      
      {/* Visual Indicator for Orchestrator */}
      {isOrchestrator && (
        <Html distanceFactor={16}>
          <div className="bg-amber-950/90 text-amber-300 font-mono px-2 py-0.5 rounded text-[10px] border border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)] whitespace-nowrap pointer-events-none flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
            👑 ORKIESTRATOR (Węzeł {agentId})
          </div>
        </Html>
      )}

      {/* Visual Indicator for Active Specialist */}
      {isSpecialist && !isOrchestrator && (
        <Html distanceFactor={18}>
          <div className="bg-emerald-950/90 text-emerald-300 font-mono px-2 py-0.5 rounded text-[9px] border border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] whitespace-nowrap pointer-events-none flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Ekspert: {agentName.split(' ')[2] || `Agent ${agentId}`}
          </div>
        </Html>
      )}

      {/* Visual Indicator for Desktop Bridge */}
      {isDesktopBridge && !isSpecialist && (
        <Html distanceFactor={19}>
          <div className="bg-cyan-950/90 text-cyan-300 font-mono px-2 py-0.5 rounded text-[8px] border border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)] whitespace-nowrap pointer-events-none flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            🖥️ Most Pulpitu (UI-TARS)
          </div>
        </Html>
      )}

      {/* Visual Indicator for Designated Speaker of Council */}
      {isSpeaker && !isOrchestrator && (
        <Html distanceFactor={18}>
          <div className="bg-gradient-to-r from-amber-950/95 to-black/90 text-amber-300 font-mono px-2 py-0.5 rounded text-[9px] border border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)] whitespace-nowrap pointer-events-none flex items-center gap-1.5 font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            🎤 SPIKER RADY: {agentName.split('[')[1]?.replace(']', '') || `Agent ${agentId}`}
          </div>
        </Html>
      )}

      {/* Visual Indicator for Other Council Members */}
      {isCouncil && !isSpeaker && !isSpecialist && !isOrchestrator && (
        <Html distanceFactor={20}>
          <div className="bg-black/85 text-cyan-200 font-mono px-1.5 py-0.5 rounded text-[8px] border border-cyan-500/70 shadow-[0_0_8px_rgba(6,182,212,0.4)] whitespace-nowrap pointer-events-none flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-emerald-400"></span>
            Rada {agentId}: {agentName.split('[')[1]?.replace(']', '') || `Model ${agentId}`}
          </div>
        </Html>
      )}

      {isSelected && !isOrchestrator && !isSpecialist && !isCouncil && !isDesktopBridge && (
        <Html distanceFactor={15}>
          <div className="bg-black/80 text-cyan-400 p-1 rounded text-xs border border-cyan-400 whitespace-nowrap pointer-events-none">
            Agent {agentId}
          </div>
        </Html>
      )}
    </group>
  );
};

// Connections between agents
const Connections = ({ points, agents, connectionColor }: { points: THREE.Vector3[], agents: any[], connectionColor: string }) => {
  const lines = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];

    // Connect close neighbors to form a net
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (points[i].distanceTo(points[j]) < 3.5) { // Connection radius
          positions.push(
            points[i].x, points[i].y, points[i].z,
            points[j].x, points[j].y, points[j].z
          );
          
          const isActive = agents[i].active && agents[j].active;
          const color = isActive ? new THREE.Color(connectionColor) : new THREE.Color('#222222');
          
          colors.push(
            color.r, color.g, color.b,
            color.r, color.g, color.b
          );
        }
      }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
  }, [points, agents, connectionColor]);

  return (
    <lineSegments geometry={lines}>
      <lineBasicMaterial vertexColors transparent opacity={0.3} />
    </lineSegments>
  );
};

const CentralPanel = () => {
  const messages = useStore((state) => state.messages);
  const mobileConnected = useStore((state) => state.mobileConnected);
  const missionMode = useStore((state) => state.missionMode);
  const isListening = useStore((state) => state.isListening);
  const cognitiveLoop = useStore((state) => state.cognitiveLoop);
  const isClusterPaused = useStore((state) => state.isClusterPaused);
  const freeOnlyMode = useStore((state) => state.freeOnlyMode);
  const isSphereRotationPaused = useStore((state) => state.isSphereRotationPaused);
  const councilBoardItems = useStore((state) => state.councilBoardItems);
  const designatedSpeakerId = useStore((state) => state.designatedSpeakerId);
  const groupRef = useRef<THREE.Group>(null);
  const elementsRef = useRef<THREE.Group>(null);
  const hologramRef = useRef<THREE.Mesh>(null);

  let themeColor = '#00ffff';
  if (missionMode === 'quantum') themeColor = '#b026ff';
  if (missionMode === 'hackathon') themeColor = '#ff3300';
  if (missionMode === 'research') themeColor = '#0088ff';
  if (isListening) themeColor = '#ff0033'; // Override color when listening (biometrics active)
  if (cognitiveLoop && !isListening) themeColor = '#00ffaa';
  if (freeOnlyMode && !isListening) themeColor = '#10b981';
  if (isClusterPaused) themeColor = '#f59e0b'; // Amber warning when paused

  useFrame((state) => {
    if (groupRef.current) {
      if (isSphereRotationPaused) {
        // Freeze rotation and align directly to camera so the board is 100% readable
        groupRef.current.rotation.y = 0;
        groupRef.current.rotation.x = 0;
      } else {
        groupRef.current.rotation.y += isClusterPaused ? 0.0006 : 0.003;
        groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * (isClusterPaused ? 0.05 : 0.2)) * 0.08;
      }
    }
    if (elementsRef.current) {
        elementsRef.current.children.forEach((child, i) => {
            child.position.y += Math.sin(state.clock.elapsedTime * 1.5 + i) * 0.003;
            child.rotation.x += 0.005;
            child.rotation.y += 0.005;
        });
    }
    if (hologramRef.current && isListening) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 15) * 0.05;
      hologramRef.current.scale.set(scale, scale, scale);
    } else if (hologramRef.current) {
      hologramRef.current.scale.set(1, 1, 1);
    }
  });

  return (
    <group ref={groupRef}>
      {/* 3D Holographic Volume */}
      <mesh ref={hologramRef}>
        <octahedronGeometry args={[5, 1]} />
        <meshBasicMaterial color={themeColor} wireframe transparent opacity={isListening ? 0.4 : 0.15} />
      </mesh>
      <mesh>
        <sphereGeometry args={[4.8, 16, 16]} />
        <meshBasicMaterial color={themeColor} wireframe transparent opacity={0.05} />
      </mesh>
      
      {/* Internal Floating Elements representing Code, Images, Audio */}
      <group ref={elementsRef}>
        {/* Code Block Representation */}
        <mesh position={[-1.5, 1, 1.5]}>
          <boxGeometry args={[1, 1.5, 0.2]} />
          <meshStandardMaterial color="#00ff00" wireframe transparent opacity={0.6} />
        </mesh>
        {/* Image Representation */}
        <mesh position={[1.5, 0, -1]}>
          <planeGeometry args={[2, 1.5]} />
          <meshStandardMaterial color="#ff00ff" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
        {/* Audio Wave Representation */}
        <group position={[0, -1.5, 1]}>
          <mesh><cylinderGeometry args={[0.1, 0.1, 2, 8]} /><meshStandardMaterial color="#ffff00" wireframe /></mesh>
          <mesh position={[0.4, 0, 0]}><cylinderGeometry args={[0.1, 0.1, 1.5, 8]} /><meshStandardMaterial color="#ffff00" wireframe /></mesh>
          <mesh position={[-0.4, 0, 0]}><cylinderGeometry args={[0.1, 0.1, 1.5, 8]} /><meshStandardMaterial color="#ffff00" wireframe /></mesh>
        </group>
        
        {/* Mobile Device Stream Representation */}
        {mobileConnected && (
          <mesh position={[0, 0, 3]}>
            <boxGeometry args={[1.8, 3.8, 0.1]} />
            <meshStandardMaterial color="#222222" emissive="#1a331a" emissiveIntensity={0.5} wireframe />
            <Html transform position={[0, 0, 0.1]} scale={0.2} distanceFactor={5}>
              <div className="w-[180px] h-[380px] bg-black/80 border-2 border-green-500 rounded-xl overflow-hidden flex flex-col pointer-events-none">
                <div className="bg-green-900/50 text-green-400 text-center text-xs py-1 animate-pulse">
                  STREAMING LIVE
                </div>
                <div className="flex-1 p-2 text-green-300 font-mono text-[10px] space-y-2 opacity-80">
                  <p>&gt; Odbiór obrazu z kamery...</p>
                  <p>&gt; Przechwytywanie ekranu (MediaProjection)...</p>
                  <p>&gt; Nasłuch mikrofonu...</p>
                  <p>&gt; Agent analizuje UI portalu z pracą...</p>
                </div>
                <div className="h-20 bg-green-950 flex items-center justify-center">
                  <div className="text-[10px] text-green-500">Skrypt Automatyzacji Aktywny</div>
                </div>
              </div>
            </Html>
          </mesh>
        )}
      </group>

      {/* 3D Holographic Main Board of the Council */}
      <group position={[0, 0, 5.2]}>
        <Html transform scale={0.16} distanceFactor={14}>
          <div className="w-[430px] bg-black/90 border-2 border-cyan-500/80 rounded-xl p-3 text-cyan-200 font-mono shadow-[0_0_30px_rgba(6,182,212,0.4)] backdrop-blur-md pointer-events-none select-none flex flex-col gap-2">
            <div className="flex justify-between items-center border-b border-cyan-800/60 pb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>🛡️ WSPÓLNA TABLICA RADY 9 MODELI (LIVE)</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-600 text-emerald-300 font-bold">
                100% FREE (0 ZŁ)
              </span>
            </div>

            <div className="flex justify-between items-center text-[10px] text-amber-300 bg-amber-950/40 border border-amber-600/40 rounded px-2 py-1">
              <span>🎤 SPIKER RADY: Agent {designatedSpeakerId} (Gemini 3.8 Flash)</span>
              <span className="text-emerald-400 font-bold">9 modeli + Most PC</span>
            </div>

            <div className="space-y-1.5 max-h-[220px] overflow-hidden text-[10px]">
              {councilBoardItems.slice(-4).map((item) => {
                const isDirective = item.type === 'user_directive';
                const isSpeakerResp = item.type === 'speaker_response';
                return (
                  <div
                    key={item.id}
                    className={`p-1.5 rounded border leading-tight ${
                      isDirective
                        ? 'bg-cyan-950/60 border-cyan-600 text-cyan-100'
                        : isSpeakerResp
                          ? 'bg-amber-950/60 border-amber-500 text-amber-100 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                          : 'bg-black/70 border-emerald-900 text-emerald-200'
                    }`}
                  >
                    <div className="font-bold text-[9px] mb-0.5 text-cyan-400 flex justify-between">
                      <span>
                        {isDirective && '📥 [DOWÓDCA DO GRUPY 9 MODELI]:'}
                        {isSpeakerResp && `📢 [🎤 SPIKER AGENT ${item.agentId} w imieniu Grupy]:`}
                        {!isDirective && !isSpeakerResp && `🧠 [${item.agentName || `Agent ${item.agentId}`}]:`}
                      </span>
                      {isSpeakerResp && <span className="text-amber-400 font-normal">Wspólna Grupa (9 modeli)</span>}
                    </div>
                    <div className="truncate">{item.content}</div>
                  </div>
                );
              })}
            </div>

            <div className="text-[9px] text-center text-cyan-500/70 border-t border-cyan-950 pt-1">
              Rada 9 Modeli: Gemini Flash • Qwen 2.5 VL • Llama Vision • Pixtral • Phi-3.5 • DeepSeek R1 • Llama 70B • Qwen Coder • Gemma 2
            </div>
          </div>
        </Html>
      </group>
    </group>
  );
};

// Glowing dispatch beams from Orchestrator to the 2-3 chosen specialists
const OrchestratorDispatchBeams = ({
  points,
  orchestratorId,
  selectedSpecialists
}: {
  points: THREE.Vector3[];
  orchestratorId: number;
  selectedSpecialists: number[];
}) => {
  const lineGeom = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];

    const orchPoint = points[orchestratorId] || points[0];

    selectedSpecialists.forEach((specId) => {
      if (specId !== orchestratorId && points[specId]) {
        const specPoint = points[specId];
        positions.push(orchPoint.x, orchPoint.y, orchPoint.z);
        positions.push(specPoint.x, specPoint.y, specPoint.z);
        
        // Amber (Orchestrator) to Emerald (Specialist)
        colors.push(0.98, 0.75, 0.14);
        colors.push(0.06, 0.72, 0.50);
      }
    });

    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geom;
  }, [points, orchestratorId, selectedSpecialists]);

  return (
    <lineSegments geometry={lineGeom}>
      <lineBasicMaterial vertexColors transparent opacity={0.85} />
    </lineSegments>
  );
};

export const CollectiveSphere = () => {
  const agents = useStore((state) => state.agents);
  const selectedAgentId = useStore((state) => state.selectedAgentId);
  const setSelectedAgentId = useStore((state) => state.setSelectedAgentId);
  const orchestratorId = useStore((state) => state.orchestratorId);
  const selectedSpecialists = useStore((state) => state.selectedSpecialists);
  const missionMode = useStore((state) => state.missionMode);
  const cognitiveLoop = useStore((state) => state.cognitiveLoop);
  const isSphereRotationPaused = useStore((state) => state.isSphereRotationPaused);

  const groupRef = useRef<THREE.Group>(null);

  // Determine colors based on mission mode
  let themeColor = '#00ffff';
  let activeColor = '#00ff00';
  let connectionColor = '#00ffaa';

  if (missionMode === 'quantum') {
    themeColor = '#b026ff';
    activeColor = '#ffd700';
    connectionColor = '#ff55ff';
  } else if (missionMode === 'hackathon') {
    themeColor = '#ff3300';
    activeColor = '#ff9900';
    connectionColor = '#ff5500';
  } else if (missionMode === 'research') {
    themeColor = '#0088ff';
    activeColor = '#00ffff';
    connectionColor = '#0066ff';
  }

  // Slowly rotate the whole sphere unless paused for reading
  useFrame(() => {
    if (groupRef.current && !isSphereRotationPaused) {
      groupRef.current.rotation.y += (missionMode === 'hackathon' ? 0.005 : 0.001);
    }
  });

  const radius = 9;
  const points = useMemo(() => getFibonacciSpherePoints(agents.length, radius), [agents.length]);

  return (
    <group>
      <group ref={groupRef}>
        <Connections points={points} agents={agents} connectionColor={connectionColor} />
        <OrchestratorDispatchBeams 
          points={points} 
          orchestratorId={orchestratorId} 
          selectedSpecialists={selectedSpecialists} 
        />
        {agents.map((agent, i) => (
          <StarAgent
            key={agent.id}
            position={points[i]}
            agentId={agent.id}
            isActive={agent.active}
            isSelected={selectedAgentId === agent.id}
            isOrchestrator={agent.id === orchestratorId}
            isSpecialist={selectedSpecialists.includes(agent.id)}
            agentName={agent.name}
            onClick={() => setSelectedAgentId(agent.id)}
            activeColor={activeColor}
            selectedColor={themeColor}
            cognitiveLoop={cognitiveLoop}
          />
        ))}
      </group>
      
      {/* Central Interactive Panel */}
      <CentralPanel />
    </group>
  );
};
