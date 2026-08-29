'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import GlassWidget from '@/components/ui/GlassWidget';
import SetRow from './SetRow';
import { useSets } from '@/hooks/useWorkouts';
import { type Exercise, type Set, db } from '@/lib/db';
import { ExerciseHistory } from '@/lib/types';
import {
  calculateTotalVolume,
  formatDate,
  getSessionMaxEstimatedOneRepMax
} from '@/lib/utils';
import ChartMetricToggle from '@/components/ui/ChartMetricToggle';
import { useChartMetricPreference } from '@/hooks/useChartMetricPreference';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface ExerciseCardProps {
  workoutExerciseId: number;
  exercise: Exercise;
  previousSets: Set[];
  readOnly?: boolean;
}

export default function ExerciseCard({
  workoutExerciseId,
  exercise,
  previousSets,
  readOnly = false
}: ExerciseCardProps) {
  const router = useRouter();
  const { sets, addSet, updateSet, deleteSet } = useSets(workoutExerciseId);
  const [deleteMode, setDeleteMode] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const setsContainerRef = useRef<HTMLDivElement>(null);
  const notesSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesHydratedRef = useRef(false);
  const { metric: chartMetric, setMetric: setChartMetric } = useChartMetricPreference();

  const workoutExercise = useLiveQuery(
    () => db.workout_exercises.get(workoutExerciseId),
    [workoutExerciseId]
  );
  const [localNotes, setLocalNotes] = useState('');

  useEffect(() => {
    notesHydratedRef.current = false;
  }, [workoutExerciseId]);

  useEffect(() => {
    if (workoutExercise === undefined || notesHydratedRef.current) return;
    setLocalNotes(workoutExercise.notes ?? '');
    notesHydratedRef.current = true;
  }, [workoutExercise, workoutExerciseId]);

  const saveNotes = useCallback((notes: string) => {
    void db.workout_exercises.update(workoutExerciseId, { notes });
  }, [workoutExerciseId]);

  const handleNotesChange = (value: string) => {
    setLocalNotes(value);
    if (notesSaveTimeoutRef.current) {
      clearTimeout(notesSaveTimeoutRef.current);
    }
    notesSaveTimeoutRef.current = setTimeout(() => saveNotes(value), 400);
  };

  useEffect(() => {
    return () => {
      if (notesSaveTimeoutRef.current) {
        clearTimeout(notesSaveTimeoutRef.current);
      }
    };
  }, []);

  // Shared values for cascading updates - use the first set's values as defaults
  const [sharedWeight, setSharedWeight] = useState<number | undefined>(previousSets?.[0]?.weight);
  const [sharedReps, setSharedReps] = useState<number | undefined>(previousSets?.[0]?.reps);

  // Update shared values when previousSets changes
  useEffect(() => {
    if (previousSets && previousSets.length > 0) {
      setSharedWeight(previousSets[0].weight);
      setSharedReps(previousSets[0].reps);
    }
  }, [previousSets]);

  // Handle value changes from any set (cascading effect)
  const handleValueChange = (field: 'weight' | 'reps', value: number) => {
    if (field === 'weight') {
      setSharedWeight(value);
    } else {
      setSharedReps(value);
    }
  };

  const currentVolume = sets ? calculateTotalVolume(sets) : 0;

  const lastRecords = useLiveQuery<ExerciseHistory[]>(async () => {
    if (!exercise?.id) return [];

    const currentWorkoutExercise = await db.workout_exercises.get(workoutExerciseId);
    const currentWorkoutId = currentWorkoutExercise?.workoutId;

    const routineNameMap = new Map(
      (await db.routines.toArray()).map((routine) => [routine.id!, routine.name])
    );

    const relatedExercises = await db.workout_exercises
      .where('exerciseId')
      .equals(exercise.id)
      .toArray();

    const history: ExerciseHistory[] = [];

    for (const related of relatedExercises) {
      if (!related.id || related.workoutId === currentWorkoutId) continue;
      const workout = await db.workouts.get(related.workoutId);
      if (!workout || !workout.endTime) continue;
      const completedSets = await db.sets
        .where('workoutExerciseId')
        .equals(related.id)
        .and((set) => set.completed)
        .toArray();
      if (completedSets.length === 0) continue;

      const totalVolume = completedSets.reduce((sum, set) => sum + set.weight * set.reps, 0);
      const maxWeight = completedSets.reduce((max, set) => Math.max(max, set.weight), 0);

      history.push({
        date: workout.date,
        sets: completedSets,
        totalVolume,
        maxWeight,
        routineName: workout.routineId
          ? routineNameMap.get(workout.routineId) || 'Unknown Routine'
          : 'Free Workout'
      });
    }

    return history
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);
  }, [exercise?.id, workoutExerciseId]);

  const sortedRecordsForChart = useMemo(() => {
    if (!lastRecords) return [];
    return [...lastRecords].sort((a, b) => a.date.localeCompare(b.date));
  }, [lastRecords]);

  const volumeChartData = useMemo(
    () => ({
      labels: sortedRecordsForChart.map((_, index) => (index + 1).toString()),
      datasets: [
        {
          label: 'Volume (kg)',
          data: sortedRecordsForChart.map((record) => record.totalVolume),
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: 'rgba(59, 130, 246, 1)',
          pointBorderColor: 'rgba(255, 255, 255, 0.8)',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    }),
    [sortedRecordsForChart]
  );

  const oneRmChartData = useMemo(
    () => ({
      labels: sortedRecordsForChart.map((_, index) => (index + 1).toString()),
      datasets: [
        {
          label: 'Estimated 1RM (kg)',
          data: sortedRecordsForChart.map((record) =>
            getSessionMaxEstimatedOneRepMax(record.sets)
          ),
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: 'rgba(59, 130, 246, 1)',
          pointBorderColor: 'rgba(255, 255, 255, 0.8)',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    }),
    [sortedRecordsForChart]
  );

  const activeProgressChartData =
    chartMetric === 'volume' ? volumeChartData : oneRmChartData;

  const volumeChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: 'rgba(255, 255, 255, 1)',
          bodyColor: 'rgba(255, 255, 255, 0.8)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            title: function (context: any) {
              const dataIndex = context[0].dataIndex;
              const record = sortedRecordsForChart[dataIndex];
              return record ? formatDate(record.date) : '';
            },
            label: function (context: any) {
              const y = context.parsed.y as number;
              const value =
                chartMetric === 'oneRm' ? y.toFixed(1) : y.toFixed(0);
              return `${context.dataset.label}: ${value} kg`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: 'rgba(255, 255, 255, 0.6)'
          }
        },
        x: {
          grid: { display: false },
          ticks: {
            color: 'rgba(255, 255, 255, 0.6)'
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index' as const
      }
    }),
    [sortedRecordsForChart, chartMetric]
  );

  useEffect(() => {
    if (sets && sets.length > 0) {
      const firstCompleted = sets.find(s => s.completed);
      if (firstCompleted && firstCompleted.weight > 0 && firstCompleted.reps > 0) {
        // Could store first set values if needed
      }
    }
  }, [sets]);

  const handleAddSet = async () => {
    const defaultValues = previousSets?.[0] ? { weight: previousSets[0].weight, reps: previousSets[0].reps } : undefined;
    await addSet(workoutExerciseId, defaultValues);
  };

  const handleDeleteSet = async (setId: number) => {
    if (sets && sets.length > 1) {
      await deleteSet(setId);
    }
  };

  const getDefaultValues = (index: number) => {
    // Return the set at the corresponding index from previous workout, or first set if not available
    const previousSet = previousSets?.[index] || previousSets?.[0];
    return previousSet ? { weight: previousSet.weight, reps: previousSet.reps } : undefined;
  };

  return (
    <GlassWidget className="p-2 md:p-4 min-w-0 max-w-full overflow-x-hidden overflow-y-visible">
      <div className="flex items-start justify-between mb-3 md:mb-4 gap-2 min-w-0">
        <div className="flex-1 min-w-0">
          <h3
            className="text-lg md:text-xl font-semibold text-blue-400 truncate cursor-pointer hover:text-blue-300 transition-colors select-none"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/exercises/${exercise.id}`);
            }}
          >
            {exercise.name}
          </h3>
          <p className="text-xs md:text-sm text-white/60">{exercise.muscleGroup}</p>
        </div>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center gap-1 text-xs text-white/70 hover:text-white focus:outline-none shrink-0"
        >
          {isExpanded ? 'Hide details' : 'Show details'}
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      <div ref={setsContainerRef} className="space-y-2 md:space-y-2 min-w-0 max-w-full">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,0.75fr)] gap-1 sm:gap-2 mb-3 text-xs sm:text-sm text-white/60 font-medium bg-white/5 rounded-lg p-2 sm:p-3 min-w-0">
          <div className="text-center truncate">Previous</div>
          <div className="text-center truncate">Weight</div>
          <div className="text-center truncate">Reps</div>
          <div className="text-center truncate">Note</div>
          <div className="text-center truncate">Done</div>
        </div>

        <div className="space-y-1 min-w-0">
          {sets?.map((set, index) => (
            <div
              key={set.id}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,0.75fr)] gap-1 sm:gap-2 items-center bg-white/5 rounded-lg p-1.5 sm:p-2 min-w-0 relative overflow-visible"
            >
              <SetRow
                set={set}
                previousBest={getDefaultValues(index)}
                sharedWeight={sharedWeight}
                sharedReps={sharedReps}
                readOnly={readOnly}
                deleteMode={deleteMode}
                canDelete={!!sets && sets.length > 1}
                onUpdate={(updates) => updateSet(set.id!, updates)}
                onValueChange={handleValueChange}
                onDelete={() => handleDeleteSet(set.id!)}
              />
            </div>
          ))}
        </div>

        {!readOnly && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAddSet}
              className="flex-1 btn btn-secondary py-2 md:py-3 text-sm min-w-0"
            >
              <Plus size={16} />
              Add Set
            </button>

            {sets && sets.length > 1 && (
              <button
                onClick={() => setDeleteMode(!deleteMode)}
                className={`flex-1 btn py-2 md:py-3 text-sm min-w-0 ${deleteMode ? 'btn-danger' : 'btn-secondary'}`}
              >
                <Trash2 size={16} />
                {deleteMode ? 'Done' : 'Remove'}
              </button>
            )}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="text-sm uppercase tracking-wide text-white/60">
                {chartMetric === 'volume' ? 'Volume history' : '1RM history'}
              </h4>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <ChartMetricToggle metric={chartMetric} onChange={setChartMetric} />
                <span className="text-xs text-white/50">previous workouts</span>
              </div>
            </div>
            {lastRecords && lastRecords.length > 0 ? (
              <div className="h-[200px]">
                <Line data={activeProgressChartData} options={volumeChartOptions} />
              </div>
            ) : (
              <p className="text-xs text-white/50">No completed history yet.</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm uppercase tracking-wide text-white/60">Last 3 records</h4>
              <span className="text-xs text-white/50">exercise history</span>
            </div>
            {lastRecords === undefined ? (
              <p className="text-xs text-white/50">Loading previous workouts...</p>
            ) : lastRecords.length === 0 ? (
              <p className="text-xs text-white/50">No completed records yet for this exercise.</p>
            ) : (
              <div className="space-y-3">
                {lastRecords.map((record) => (
                  <div
                    key={`${record.date}-${record.routineName}`}
                    className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p
                          className="text-xs uppercase tracking-wide text-white/50"
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          {record.routineName}
                        </p>
                        <h3 className="text-sm font-semibold text-white">{formatDate(record.date)}</h3>
                      </div>
                      <div className="text-right text-xs text-white/60 space-y-1">
                        <div>
                          Volume:{' '}
                          <span className="font-semibold text-white">
                            {record.totalVolume.toFixed(0)} kg
                          </span>
                        </div>
                        <div>
                          Max:{' '}
                          <span className="font-semibold text-white">
                            {record.maxWeight.toFixed(1)} kg
                          </span>
                        </div>
                        <div>
                          Sets:{' '}
                          <span className="font-semibold text-white">{record.sets.length}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {record.sets.map((set, setIndex) => (
                        <div
                          key={set.id ?? `${record.date}-${setIndex}`}
                          className="rounded-lg bg-white/10 p-2 text-center"
                        >
                          <p className="text-xs text-white/40 mb-1">Set {setIndex + 1}</p>
                          <p className="text-sm font-semibold text-white">
                            {set.weight.toFixed(1)}kg × {set.reps}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="relative z-[100] mt-3 md:mt-4 pt-3 md:pt-4 border-t border-white/10 min-w-0">
        <div className="flex flex-row items-end justify-between gap-4 min-w-0">
          <div className="flex-1 min-w-0 relative z-[100]">
            {readOnly ? (
              localNotes ? (
                <p className="text-xs md:text-sm text-white/80 whitespace-pre-wrap break-words">
                  {localNotes}
                </p>
              ) : (
                <p className="text-xs md:text-sm text-white/30">No notes</p>
              )
            ) : (
              <textarea
                value={localNotes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Add your notes here"
                rows={1}
                className="block w-full bg-transparent text-xs md:text-sm text-white/80 placeholder:text-white/30 border-0 outline-none resize-none focus:ring-0 leading-relaxed [field-sizing:content] min-h-[1.25rem]"
              />
            )}
          </div>
          <div className="text-xs md:text-sm shrink-0 text-right whitespace-nowrap">
            <span className="text-white/60">Total Volume: </span>
            <span className="text-white font-semibold">{currentVolume.toFixed(0)} kg</span>
          </div>
        </div>
      </div>
    </GlassWidget>
  );
}

