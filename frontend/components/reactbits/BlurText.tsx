'use client';
import React from 'react';
import { motion } from 'framer-motion';

interface BlurTextProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
}

export default function BlurText({
  text,
  className = '',
  delay = 0.03,
  duration = 0.6
}: BlurTextProps) {
  const letters = text.split('');

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
    hidden: { opacity: 0, filter: 'blur(10px)', y: 5 },
    visible: {
      opacity: 1,
      filter: 'blur(0px)',
      y: 0,
      transition: {
        duration: duration,
        ease: 'easeOut',
      },
    },
  } as any;

  return (
    <motion.span
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ display: 'inline-block' }}
    >
      {letters.map((char, index) => (
        <motion.span
          key={index}
          variants={childVariants}
          style={{
            display: 'inline-block',
            whiteSpace: char === ' ' ? 'pre' : 'normal',
          }}
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
}
