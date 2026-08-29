'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { SetRating } from '@/lib/db';

const RATING_COLORS: Record<SetRating, string> = {
  1: '#ef4444',
  2: '#f97316',
  3: '#eab308',
  4: '#86efac',
  5: '#22c55e'
};

const RATING_OPTIONS: SetRating[] = [1, 2, 3, 4, 5];

const CIRCLE_SIZE = 20;
const ITEM_GAP = 6;
const PANEL_PADDING_X = 8;
const ITEM_COUNT = 6;
const EXPANDED_WIDTH =
  PANEL_PADDING_X * 2 + ITEM_COUNT * CIRCLE_SIZE + (ITEM_COUNT - 1) * ITEM_GAP;

const SPRING_OPEN = { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.8 };
const SPRING_CLOSE = { type: 'spring' as const, stiffness: 480, damping: 36, mass: 0.7 };
const SPRING_POP = { type: 'spring' as const, stiffness: 520, damping: 24, mass: 0.55 };

type AnimationPhase = 'idle' | 'expanding' | 'expanded' | 'collapsing-items' | 'collapsing-box';

interface SetRatingPickerProps {
  rating?: SetRating;
  readOnly?: boolean;
  onChange: (rating: SetRating | undefined) => void;
}

export function getRatingColor(rating?: SetRating): string | undefined {
  return rating ? RATING_COLORS[rating] : undefined;
}

export default function SetRatingPicker({
  rating,
  readOnly = false,
  onChange
}: SetRatingPickerProps) {
  const [phase, setPhase] = useState<AnimationPhase>('idle');
  const phaseRef = useRef<AnimationPhase>(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const displayColor = getRatingColor(rating);
  const isOpen = phase !== 'idle';
  const showItems = phase === 'expanded';
  const isExpanded =
    phase === 'expanding' || phase === 'expanded' || phase === 'collapsing-items';

  const openPicker = () => {
    if (phaseRef.current !== 'idle') return;
    setPhase('expanding');
  };

  const closePicker = useCallback(() => {
    const current = phaseRef.current;
    if (current === 'idle' || current === 'collapsing-items' || current === 'collapsing-box') {
      return;
    }
    if (current === 'expanding') {
      setPhase('collapsing-box');
      return;
    }
    setPhase('collapsing-items');
  }, []);

  const handlePanelAnimationComplete = () => {
    const current = phaseRef.current;
    if (current === 'expanding') {
      setPhase('expanded');
    }
    if (current === 'collapsing-box') {
      setPhase('idle');
    }
  };

  const handleItemsExitComplete = () => {
    if (phaseRef.current === 'collapsing-items') {
      setPhase('collapsing-box');
    }
  };

  const handleSelect = (value: SetRating | undefined) => {
    closePicker();
    onChange(value);
  };

  if (readOnly) {
    return (
      <div className="flex justify-center py-2">
        <span
          className="inline-block w-5 h-5 rounded-full shrink-0"
          style={{ backgroundColor: displayColor ?? 'rgba(255,255,255,0.25)' }}
          aria-label={rating ? `Rating ${rating}` : 'Unrated'}
        />
      </div>
    );
  }

  return (
    <div className="relative flex justify-center items-center py-2 min-w-0">
      <button
        type="button"
        onClick={openPicker}
        className={`w-5 h-5 rounded-full shrink-0 transition-opacity duration-300 focus:outline-none focus:ring-2 focus:ring-white/30 ${
          isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100 hover:scale-110'
        }`}
        style={{ backgroundColor: displayColor ?? 'rgba(255,255,255,0.25)' }}
        aria-label={rating ? `Rating ${rating}, tap to change` : 'Add set rating'}
        aria-hidden={isOpen}
        tabIndex={isOpen ? -1 : 0}
      />

      <AnimatePresence>
        {isOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-[105]"
              aria-label="Close rating picker"
              onClick={closePicker}
            />
            <motion.div
              key="rating-panel"
              className="absolute top-1/2 z-[110] flex items-center overflow-hidden border border-white/15 bg-gray-900/95 shadow-lg -translate-y-1/2"
              style={{
                right: '50%',
                marginRight: -CIRCLE_SIZE / 2,
                height: CIRCLE_SIZE + 8,
                transformOrigin: 'right center'
              }}
              initial={{ width: CIRCLE_SIZE, opacity: 1, borderRadius: CIRCLE_SIZE / 2 }}
              animate={{
                width: isExpanded ? EXPANDED_WIDTH : CIRCLE_SIZE,
                borderRadius: isExpanded ? 10 : CIRCLE_SIZE / 2
              }}
              transition={phase === 'collapsing-box' ? SPRING_CLOSE : SPRING_OPEN}
              onAnimationComplete={handlePanelAnimationComplete}
            >
              <div
                className="flex h-full w-full items-center justify-center"
                style={{ paddingInline: PANEL_PADDING_X, gap: ITEM_GAP }}
              >
                <AnimatePresence onExitComplete={handleItemsExitComplete}>
                  {showItems &&
                    RATING_OPTIONS.map((value, index) => (
                      <motion.button
                        key={value}
                        type="button"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{
                          scale: 0,
                          opacity: 0,
                          transition: {
                            ...SPRING_POP,
                            delay: (RATING_OPTIONS.length - index) * 0.03
                          }
                        }}
                        transition={{
                          ...SPRING_POP,
                          delay: index * 0.04
                        }}
                        onClick={() => handleSelect(value)}
                        className="w-5 h-5 rounded-full shrink-0"
                        style={{ backgroundColor: RATING_COLORS[value] }}
                        aria-label={`Rate ${value}`}
                      />
                    ))}
                  {showItems && (
                    <motion.button
                      key="clear"
                      type="button"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{
                        scale: 0,
                        opacity: 0,
                        transition: { ...SPRING_POP, delay: 0 }
                      }}
                      transition={{
                        ...SPRING_POP,
                        delay: RATING_OPTIONS.length * 0.04
                      }}
                      onClick={() => handleSelect(undefined)}
                      className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center bg-white/10"
                      aria-label="Clear rating"
                    >
                      <X size={12} className="text-white/70" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
