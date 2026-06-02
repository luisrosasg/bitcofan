import { useEffect, useRef } from 'react'

export default function Toast({ message, onDone }) {
  const onDoneRef = useRef(onDone)
  useEffect(() => { onDoneRef.current = onDone }, [onDone])

  useEffect(() => {
    const t = setTimeout(() => onDoneRef.current?.(), 2500)
    return () => clearTimeout(t)
  }, []) // only runs once on mount

  return <div className="toast">{message}</div>
}
