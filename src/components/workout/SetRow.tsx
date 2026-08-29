'use client';

import { useState, useEffect } from 'react';
import { CheckSquare, Square, Trash2 } from 'lucide-react';
import { type Set, type SetRating } from '@/lib/db';
import SetRatingPicker from './SetRatingPicker';

interface SetRowProps {
  set: Set;
  previousBest?: { weight: number; reps: number };
  sharedWeight?: number;
  sharedReps?: number;
  readOnly?: boolean;
  deleteMode?: boolean;
  canDelete?: boolean;
  onUpdate: (updates: Partial<Set>) => void;
  onValueChange?: (field: 'weight' | 'reps', value: number) => void;
  onDelete?: () => void;
}

export default function SetRow({
  set,
  previousBest,
  sharedWeight,
  sharedReps,
  readOnly = false,
  deleteMode = false,
  canDelete = false,
  onUpdate,
  onValueChange,
  onDelete
}: SetRowProps) {
  const defaultWeight = typeof (sharedWeight ?? previousBest?.weight) === 'number'
    ? (sharedWeight ?? previousBest?.weight)!
    : 0;
  const defaultReps = typeof (sharedReps ?? previousBest?.reps) === 'number'
    ? (sharedReps ?? previousBest?.reps)!
    : 0;

  const [localWeight, setLocalWeight] = useState<number | ''>(set.weight || '');
  const [localReps, setLocalReps] = useState<number | ''>(set.reps || '');

  useEffect(() => {
    const currentWeight = typeof localWeight === 'number' ? localWeight : 0;
    const currentReps = typeof localReps === 'number' ? localReps : 0;

    if (currentWeight !== set.weight && currentWeight !== 0) return;
    if (currentReps !== set.reps && currentReps !== 0) return;

    setLocalWeight(set.weight || '');
    setLocalReps(set.reps || '');
  }, [set.weight, set.reps, localWeight, localReps]);

  const handleWeightChange = (value: string) => {
    if (readOnly) return;
    const numValue = value === '' ? '' : Number(value);
    setLocalWeight(numValue);

    if (typeof numValue === 'number') {
      onUpdate({ weight: numValue });
      onValueChange?.('weight', numValue);
    }
  };

  const handleRepsChange = (value: string) => {
    if (readOnly) return;
    const numValue = value === '' ? '' : Number(value);
    setLocalReps(numValue);

    if (typeof numValue === 'number') {
      onUpdate({ reps: numValue });
      onValueChange?.('reps', numValue);
    }
  };

  const weightPlaceholder = sharedWeight ?? previousBest?.weight ?? 'kg';
  const repsPlaceholder = sharedReps ?? previousBest?.reps ?? 'reps';

  const inputClassName = `
    w-full min-w-0 max-w-full
    bg-transparent
    text-center
    text-sm
    border-0
    outline-none
    shadow-none
    appearance-none
    focus:outline-none
    focus:ring-0
    focus:border-0
    p-0
    m-0
  `;

  return (
    <>
      <div className="text-center py-2 min-w-0">
        {previousBest ? (
          <span className="text-white/40 text-sm truncate block">
            {previousBest.weight}×{previousBest.reps}
          </span>
        ) : (
          <span className="text-white/20 text-sm">-</span>
        )}
      </div>

      <div className="py-2 min-w-0">
        {readOnly ? (
          <span className="block text-center text-sm text-white/80">
            {set.weight || '-'}
          </span>
        ) : (
          <input
            type="number"
            value={localWeight}
            onChange={(e) => handleWeightChange(e.target.value)}
            placeholder={typeof weightPlaceholder === 'number' ? weightPlaceholder.toString() : weightPlaceholder}
            className={inputClassName}
            inputMode="decimal"
          />
        )}
      </div>

      <div className="px-1 py-2 min-w-0">
        {readOnly ? (
          <span className="block text-center text-sm text-white/80">
            {set.reps || '-'}
          </span>
        ) : (
          <input
            type="number"
            value={localReps}
            onChange={(e) => handleRepsChange(e.target.value)}
            placeholder={typeof repsPlaceholder === 'number' ? repsPlaceholder.toString() : repsPlaceholder}
            className={inputClassName}
            inputMode="decimal"
          />
        )}
      </div>

      <SetRatingPicker
        rating={set.rating}
        readOnly={readOnly}
        onChange={(rating: SetRating | undefined) => onUpdate({ rating })}
      />

      <div className="flex justify-center py-2 min-w-0">
        {deleteMode && canDelete && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors"
            aria-label="Delete set"
          >
            <Trash2 size={16} className="text-red-400" />
          </button>
        ) : readOnly ? (
          <span className="p-2">
            {set.completed ? (
              <CheckSquare size={18} className="text-green-400" />
            ) : (
              <Square size={18} className="text-white/30" />
            )}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              const isCompleting = !set.completed;
              const updates: Partial<Set> = { completed: isCompleting };

              if (isCompleting) {
                const finalWeight = (typeof localWeight === 'number' && localWeight > 0) ? localWeight : defaultWeight;
                const finalReps = (typeof localReps === 'number' && localReps > 0) ? localReps : defaultReps;

                updates.weight = finalWeight;
                updates.reps = finalReps;

                setLocalWeight(finalWeight);
                setLocalReps(finalReps);
              }

              onUpdate(updates);
            }}
            className={`p-2 rounded-lg transition-colors ${
              set.completed
                ? 'bg-green-500/20 text-green-400'
                : 'bg-white/5 text-white/40 hover:bg-white/10'
            }`}
          >
            {set.completed ? <CheckSquare size={18} /> : <Square size={18} />}
          </button>
        )}
      </div>
    </>
  );
}
