import React, { useState, useEffect } from 'react'

interface NewImageNotificationProps {
  show: boolean
  count: number
  onDismiss: () => void
}

export const NewImageNotification: React.FC<NewImageNotificationProps> = ({ 
  show, 
  count, 
  onDismiss 
}) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (show) {
      setIsVisible(true)
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(onDismiss, 300) // Wait for animation to complete
      }, 3000) // Show for 3 seconds
      
      return () => clearTimeout(timer)
    }
  }, [show, onDismiss])

  if (!show) return null

  return (
    <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
      isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
    }`}>
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
        <div className="text-xl animate-pulse">🎉</div>
        <div>
          <p className="font-semibold text-sm">
            {count === 1 ? 'New processed image added!' : `${count} new processed images added!`}
          </p>
          <p className="text-xs text-green-100">Check the gallery below</p>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-white hover:text-green-200 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  )
} 