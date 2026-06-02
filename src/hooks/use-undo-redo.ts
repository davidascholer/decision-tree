import { useState, useCallback, useRef, useEffect } from 'react'

interface HistoryState<T> {
  past: T[]
  present: T
  future: T[]
}

interface UseUndoRedoOptions {
  maxHistorySize?: number
}

export function useUndoRedo<T>(
  initialValue: T,
  onStateChange: (state: T) => void,
  options: UseUndoRedoOptions = {}
) {
  const { maxHistorySize = 50 } = options
  
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialValue,
    future: []
  })

  const isUndoRedoAction = useRef(false)

  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0

  const pushState = useCallback((newState: T) => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false
      return
    }

    setHistory(currentHistory => {
      const newPast = [...currentHistory.past, currentHistory.present]
      
      if (newPast.length > maxHistorySize) {
        newPast.shift()
      }

      return {
        past: newPast,
        present: newState,
        future: []
      }
    })
  }, [maxHistorySize])

  const undo = useCallback(() => {
    if (!canUndo) return

    setHistory(currentHistory => {
      const previous = currentHistory.past[currentHistory.past.length - 1]
      const newPast = currentHistory.past.slice(0, currentHistory.past.length - 1)

      isUndoRedoAction.current = true
      onStateChange(previous)

      return {
        past: newPast,
        present: previous,
        future: [currentHistory.present, ...currentHistory.future]
      }
    })
  }, [canUndo, onStateChange])

  const redo = useCallback(() => {
    if (!canRedo) return

    setHistory(currentHistory => {
      const next = currentHistory.future[0]
      const newFuture = currentHistory.future.slice(1)

      isUndoRedoAction.current = true
      onStateChange(next)

      return {
        past: [...currentHistory.past, currentHistory.present],
        present: next,
        future: newFuture
      }
    })
  }, [canRedo, onStateChange])

  const reset = useCallback((newState: T) => {
    setHistory({
      past: [],
      present: newState,
      future: []
    })
  }, [])

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    pushState,
    reset
  }
}
