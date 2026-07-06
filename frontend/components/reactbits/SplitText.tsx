'use client';
import React from 'react';
import { motion } from 'framer-motion';

interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
}

export default function SplitText({
  text,
  className = '',
  delay = 0.05,
  duration = 0.5
}: SplitTextProps) {
  const words = text.split(' ');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: delay,
      },
    },
  } as any;

  const childVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: duration,
        ease: [0.2, 0.65, 0.3, 0.9],
      },
    },
  } as any;

  return (
    <motion.span
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ display: 'inline-block', whiteSpace: 'pre-wrap' }}
    >
      {words.map((word, wIdx) => (
        <span key={wIdx} style={{ display: 'inline-block', marginRight: '0.25em' }}>
          {word.split('').map((char, cIdx) => (
            <motion.span
              key={cIdx}
              variants={childVariants}
              style={{ display: 'inline-block' }}
            >
              {char}
            </motion.span>
          ))}
        </span>
      ))}
    </motion.span>
  );
}
