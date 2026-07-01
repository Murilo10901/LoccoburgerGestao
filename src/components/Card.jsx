import { forwardRef } from 'react'

export const Card = forwardRef(function Card({ children, className = '', ...props }, ref) {
  return <section className={`card ${className}`} ref={ref} {...props}>{children}</section>
})
