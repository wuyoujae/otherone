'use client';

import { useState, useEffect, useRef } from 'react';

type Expression = 'idle' | 'sleep' | 'happy' | 'study' | 'sip' | 'dizzy';

const EXPR_POOL: Expression[] = ['sleep', 'happy', 'study', 'sip', 'dizzy'];

export function AnimatedLogo({ size = 48 }: { size?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const leftEyeRef = useRef<SVGCircleElement>(null);
  const rightEyeRef = useRef<SVGCircleElement>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const [expr, setExpr] = useState<Expression>('idle');
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    const MAX_OFFSET = 3;
    const LERP = 0.08;

    function onMouseMove(e: MouseEvent) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clamp = Math.min(dist / 120, 1);
      targetRef.current = {
        x: (dx / (dist || 1)) * MAX_OFFSET * clamp,
        y: (dy / (dist || 1)) * MAX_OFFSET * clamp,
      };
    }

    function tick() {
      const cur = currentRef.current;
      const tgt = targetRef.current;
      cur.x += (tgt.x - cur.x) * LERP;
      cur.y += (tgt.y - cur.y) * LERP;
      const left = leftEyeRef.current;
      const right = rightEyeRef.current;
      if (left && right) {
        const t = `translate(${cur.x}px, ${cur.y}px)`;
        left.style.transform = t;
        right.style.transform = t;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    window.addEventListener('mousemove', onMouseMove);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    let tid: ReturnType<typeof setTimeout>;
    function next() {
      const idle = 10000 + Math.random() * 10000;
      tid = setTimeout(() => {
        const pick = EXPR_POOL[Math.floor(Math.random() * EXPR_POOL.length)];
        setExpr(pick);
        const hold = 3000 + Math.random() * 3000;
        tid = setTimeout(() => {
          setExpr('idle');
          next();
        }, hold);
      }, idle);
    }
    next();
    return () => clearTimeout(tid);
  }, []);

  useEffect(() => {
    if (expr !== 'idle') { setBlinking(false); return; }
    let tid: ReturnType<typeof setTimeout>;
    function scheduleBlink() {
      tid = setTimeout(() => {
        setBlinking(true);
        tid = setTimeout(() => {
          setBlinking(false);
          scheduleBlink();
        }, 150);
      }, 2500 + Math.random() * 3500);
    }
    scheduleBlink();
    return () => clearTimeout(tid);
  }, [expr]);

  useEffect(() => {
    if (expr !== 'idle') {
      targetRef.current = { x: 0, y: 0 };
    }
  }, [expr]);

  const isIdle = expr === 'idle';
  const showNormalEyes = isIdle && !blinking;

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 88 88"
      fill="none"
      width={size}
      height={size}
    >
      <circle cx="44" cy="44" r="40" stroke="currentColor" strokeWidth="3.2" />

      <g style={{ opacity: showNormalEyes ? 1 : 0, transition: 'opacity 0.15s' }}>
        <circle ref={leftEyeRef} cx="30" cy="26" r="4.5" fill="currentColor" style={{ willChange: 'transform' }} />
        <circle ref={rightEyeRef} cx="58" cy="26" r="4.5" fill="currentColor" style={{ willChange: 'transform' }} />
      </g>

      <g style={{ opacity: blinking && isIdle ? 1 : 0, transition: 'opacity 0.08s' }}>
        <line x1="24" y1="26" x2="36" y2="26" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <line x1="52" y1="26" x2="64" y2="26" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </g>

      {expr === 'sleep' && (
        <g className="fab-expr-in">
          <line x1="24" y1="28" x2="36" y2="28" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <line x1="52" y1="28" x2="64" y2="28" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <text className="fab-zzz" x="64" y="18" fill="currentColor" fontSize="9" fontWeight="800" fontFamily="sans-serif" style={{ animationDelay: '0s' }}>z</text>
          <text className="fab-zzz" x="70" y="10" fill="currentColor" fontSize="11" fontWeight="800" fontFamily="sans-serif" style={{ animationDelay: '0.4s' }}>z</text>
          <text className="fab-zzz" x="74" y="2" fill="currentColor" fontSize="13" fontWeight="800" fontFamily="sans-serif" style={{ animationDelay: '0.8s' }}>z</text>
        </g>
      )}

      {expr === 'happy' && (
        <g className="fab-expr-in">
          <path d="M24 28 Q30 20 36 28" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M52 28 Q58 20 64 28" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M34 42 Q44 52 54 42" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      )}

      {expr === 'study' && (
        <g className="fab-expr-in">
          <circle cx="30" cy="30" r="4.5" fill="currentColor" />
          <circle cx="58" cy="30" r="4.5" fill="currentColor" />
          <rect x="26" y="52" width="36" height="5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="44" y1="52" x2="44" y2="57" stroke="currentColor" strokeWidth="1.5" />
          <line x1="30" y1="55" x2="41" y2="55" stroke="currentColor" strokeWidth="1" opacity="0.3" />
          <line x1="47" y1="55" x2="58" y2="55" stroke="currentColor" strokeWidth="1" opacity="0.3" />
        </g>
      )}

      {expr === 'sip' && (
        <g className="fab-expr-in">
          <circle cx="33" cy="26" r="4.5" fill="currentColor" />
          <circle cx="56" cy="26" r="4" fill="currentColor" />
          <rect x="60" y="36" width="14" height="18" rx="3" stroke="currentColor" strokeWidth="2.2" fill="none" />
          <path d="M74 41 Q80 41 80 47 Q80 51 74 51" stroke="currentColor" strokeWidth="2" fill="none" />
          <path className="fab-steam" d="M64 34 Q64 28 66 28" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path className="fab-steam fab-steam-d1" d="M68 33 Q68 26 70 26" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </g>
      )}

      {expr === 'dizzy' && (
        <g className="fab-expr-in">
          <g className="fab-spin">
            <circle cx="30" cy="26" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
            <circle cx="30" cy="26" r="2.5" fill="currentColor" />
          </g>
          <g className="fab-spin-reverse">
            <circle cx="58" cy="26" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
            <circle cx="58" cy="26" r="2.5" fill="currentColor" />
          </g>
          <path d="M36 46 Q40 42 44 46 Q48 50 52 46" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
