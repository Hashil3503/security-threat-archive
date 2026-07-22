import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export interface CarouselItem {
    id: string;
    label: string;
    icon: string; // Emoji or icon text
    content: React.ReactNode;
}

interface DashboardCarouselProps {
    items: CarouselItem[];
    backgroundColor?: string;
    initialIndex?: number;
}

function modIdx(i: number, n: number) {
    return ((i % n) + n) % n;
}

function easeCubicInOut(p: number) {
    return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

export default function DashboardCarousel({
    items,
    backgroundColor = "transparent",
    initialIndex = 0
}: DashboardCarouselProps) {
    const M = items.length;
    const [posDisplay, setPosDisplay] = useState(initialIndex);
    const posRef = useRef(initialIndex);
    const rafRef = useRef<number | null>(null);
    const animRef = useRef({ startPos: initialIndex, targetPos: initialIndex, startTime: 0 });
    const [dir, setDir] = useState(1);

    const active = modIdx(Math.round(posDisplay), M);

    const select = useCallback(
        (itemIdx: number) => {
            const currentActive = modIdx(Math.round(posRef.current), M);
            if (itemIdx === currentActive) return;

            let delta = itemIdx - Math.round(posRef.current);
            delta = ((delta % M) + M) % M;
            if (delta > M / 2) delta -= M;
            setDir(Math.sign(delta));

            if (rafRef.current) cancelAnimationFrame(rafRef.current);

            animRef.current = {
                startPos: posRef.current,
                targetPos: posRef.current + delta,
                startTime: performance.now(),
            };

            const DURATION = 350;
            function tick(now: number) {
                const { startPos, targetPos, startTime } = animRef.current;
                const progress = Math.min(1, (now - startTime) / DURATION);
                posRef.current =
                    startPos + (targetPos - startPos) * easeCubicInOut(progress);
                setPosDisplay(posRef.current);
                if (progress < 1) {
                    rafRef.current = requestAnimationFrame(tick);
                } else {
                    posRef.current = targetPos;
                    setPosDisplay(targetPos);
                    rafRef.current = null;
                }
            }
            rafRef.current = requestAnimationFrame(tick);
        },
        [M]
    );

    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    // Arc layout parameters
    const buttonSize = 48;
    const gap = 16;
    const curve = 4;
    const buttonCount = M;
    const half = Math.floor(buttonCount / 2);
    
    const t = Math.max(0.0001, Math.min(10, curve) / 10);
    const step = buttonSize + gap;
    const dPsi = ((Math.PI * 2) / M) * t;
    const R = step / (2 * Math.sin(dPsi / 2));
    const baseTop = buttonSize * 0.5;
    
    const maxPsi = Math.min(Math.PI, (half + 0.6) * dPsi);
    const stripHeight = baseTop + R * (1 - Math.cos(maxPsi)) + buttonSize / 2 + 8;

    function getVisualSlot(itemIdx: number): number {
        let slot = itemIdx - posDisplay;
        slot = slot % M;
        if (slot > M / 2) slot -= M;
        if (slot < -M / 2) slot += M;
        return slot;
    }

    function slotStyle(slot: number) {
        const angle = slot * dPsi;
        const x = R * Math.sin(angle);
        const y = R * (1 - Math.cos(angle));
        const deg = (angle * 180) / Math.PI;
        const absSlot = Math.abs(slot);
        const depth = Math.max(0, 1 - (0.4 * absSlot) / Math.max(1, half));
        const scale = 0.65 + 0.35 * depth;
        const opacity = Math.max(0.2, 1 - 0.5 * absSlot);
        const zIndex = Math.round(depth * 100) + (absSlot < 0.5 ? 100 : 0);
        return { x, y, deg, scale, opacity, zIndex };
    }

    const slideVariants = {
        enter: (d: number) => ({
            x: d * 300,
            opacity: 0,
            scale: 0.95,
        }),
        center: {
            x: 0,
            opacity: 1,
            scale: 1,
        },
        exit: (d: number) => ({
            x: -d * 300,
            opacity: 0,
            scale: 0.95,
        }),
    };

    // Calculate dynamic minHeight based on slide index for proper vertical layout fit
    const getDynamicMinHeight = () => {
        // active 0: 'all' (🌐) -> Needs more vertical room
        if (active === 0) return "540px";
        // active 1: 'stats' (📊) -> Card grid
        if (active === 1) return "240px";
        // active 2 & 3: charts (📁, 📈)
        return "340px";
    };

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: backgroundColor,
                gap: "1.5rem",
                boxSizing: "border-box",
                overflow: "hidden"
            }}
        >
            {/* Slide View Container with smooth height transition */}
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    minHeight: getDynamicMinHeight(),
                    display: "flex",
                    alignItems: "stretch",
                    justifyContent: "stretch",
                    overflow: "hidden",
                    transition: "min-height 0.4s cubic-bezier(0.16, 1, 0.3, 1)"
                }}
            >
                <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                    <motion.div
                        key={active}
                        custom={dir}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                            width: "100%",
                            paddingTop: "12px",
                            paddingBottom: "12px"
                        }}
                    >
                        {items[active]?.content}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Menu Label */}
            <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                    key={`label-${active}`}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.25 }}
                    style={{
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        background: "rgba(99, 102, 241, 0.15)",
                        padding: "0.3rem 1rem",
                        borderRadius: "20px",
                        border: "1px solid rgba(99, 102, 241, 0.3)",
                        boxShadow: "0 0 10px rgba(99, 102, 241, 0.15)",
                        textAlign: "center"
                    }}
                >
                    {items[active]?.label}
                </motion.div>
            </AnimatePresence>

            {/* Navigation Button Arc */}
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: stripHeight,
                    overflow: "hidden"
                }}
            >
                {items.map((_, itemIdx) => {
                    const slot = getVisualSlot(itemIdx);
                    const { x, y, deg, scale, opacity, zIndex } = slotStyle(slot);
                    const isActive = itemIdx === active;

                    return (
                        <div
                            key={itemIdx}
                            style={{
                                position: "absolute",
                                left: "50%",
                                top: baseTop,
                                marginLeft: -buttonSize / 2,
                                marginTop: -buttonSize / 2,
                                width: buttonSize,
                                height: buttonSize,
                                transform: `translate(${x}px, ${y}px) rotate(${deg}deg) scale(${scale})`,
                                transformOrigin: "center",
                                opacity,
                                zIndex,
                                willChange: "transform, opacity",
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => select(itemIdx)}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    borderRadius: "50%",
                                    border: isActive ? "2px solid #818cf8" : "1px solid rgba(255, 255, 255, 0.15)",
                                    background: isActive
                                        ? "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"
                                        : "rgba(15, 23, 42, 0.8)",
                                    boxShadow: isActive ? "0 0 15px rgba(99, 102, 241, 0.6)" : "none",
                                    color: isActive ? "#ffffff" : "var(--text-secondary)",
                                    fontSize: "1.4rem",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    transition: "all 0.25s ease",
                                    outline: "none"
                                }}
                            >
                                {items[itemIdx]?.icon}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
