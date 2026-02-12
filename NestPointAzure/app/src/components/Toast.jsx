import React, { useEffect } from 'react'

export function Toast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3200)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className="toast" role="status" aria-live="polite" onClick={onClose}>
      {message}
    </div>
  )
}
