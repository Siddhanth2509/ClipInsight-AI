'use client';
import React, { useState, useEffect, useRef } from 'react';

interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  characters?: string;
  className?: string;
}

export default function DecryptedText({
  text,
  speed = 40,
  maxIterations = 8,
  characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()',
  className = ''
}: DecryptedTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let iteration = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setDisplayText((current) =>
        text
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' ';
            if (index < iteration) return text[index];
            return characters[Math.floor(Math.random() * characters.length)];
          })
          .join('')
      );

      if (iteration >= text.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
      iteration += text.length / maxIterations;
    }, speed);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, speed, maxIterations, characters]);

  return <span className={className}>{displayText}</span>;
}
