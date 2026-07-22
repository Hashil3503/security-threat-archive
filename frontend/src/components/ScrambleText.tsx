import React, { useState, useEffect, useRef, useCallback } from 'react';

interface ScrambleTextProps {
    words: string;
    color?: string;
    scrambleDuration?: number;
    className?: string;
    style?: React.CSSProperties;
    tag?: React.ElementType;
    autoStart?: boolean;
}

const GLITCH_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+-=[]{}|;:,.<>?/";

export default function ScrambleText({
    words,
    color = "inherit",
    scrambleDuration = 1400,
    className = "",
    style = {},
    tag: TagComponent = "span",
    autoStart = true
}: ScrambleTextProps) {
    const [revealedCount, setRevealedCount] = useState<number>(autoStart ? 0 : words.length);
    const [scrambleCharMap, setScrambleCharMap] = useState<Record<number, string>>({});
    const [isEnterComplete, setIsEnterComplete] = useState<boolean>(!autoStart);

    const animRef = useRef<number | null>(null);

    // ── Enter Reveal Animation (Progressive Build-up) ────────────────────────
    const startEnterAnimation = useCallback(() => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
        setIsEnterComplete(false);
        setRevealedCount(0);

        const startTime = performance.now();
        const totalChars = words.length;

        const tick = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / scrambleDuration, 1);
            
            const currentRevealed = Math.floor(progress * (totalChars + 1));
            setRevealedCount(currentRevealed);

            const nextMap: Record<number, string> = {};
            if (currentRevealed < totalChars) {
                nextMap[currentRevealed] = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
            }
            setScrambleCharMap(nextMap);

            if (progress < 1) {
                animRef.current = requestAnimationFrame(tick);
            } else {
                setRevealedCount(totalChars);
                setScrambleCharMap({});
                setIsEnterComplete(true);
            }
        };

        animRef.current = requestAnimationFrame(tick);
    }, [words, scrambleDuration]);

    useEffect(() => {
        if (autoStart) {
            startEnterAnimation();
        }
        return () => {
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, [autoStart, startEnterAnimation]);

    return (
        <TagComponent
            className={`scramble-text-container ${className}`}
            style={{
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                verticalAlign: 'bottom',
                color: color,
                ...style
            }}
        >
            {words.split('').map((char, index) => {
                const isHidden = !isEnterComplete && index > revealedCount;
                let displayChar = char;

                if (!isEnterComplete && index === revealedCount && scrambleCharMap[index]) {
                    displayChar = scrambleCharMap[index];
                }

                return (
                    <span
                        key={index}
                        style={{
                            color: isHidden ? 'transparent' : color,
                            visibility: isHidden ? 'hidden' : 'visible',
                            whiteSpace: char === ' ' ? 'pre' : 'normal'
                        }}
                    >
                        {displayChar}
                    </span>
                );
            })}
        </TagComponent>
    );
}
