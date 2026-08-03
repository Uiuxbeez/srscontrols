import { useEffect, useRef } from "react"

interface TextOptions {
  size?: number
  copy?: string
  color?: string
  delay?: number
  yFraction?: number
}

interface TextBound {
  width: number
  height: number
}

class Text {
  size: number
  copy: string
  color: string
  delay: number
  basedelay: number
  bound: TextBound
  x: number
  y: number
  data: ImageData
  index: number

  constructor(options: TextOptions, canvasWidth: number, canvasHeight: number) {
    const pool = document.createElement("canvas")
    const buffer = pool.getContext("2d")!
    pool.width = canvasWidth
    pool.height = canvasHeight
    buffer.fillStyle = "#000000"
    buffer.fillRect(0, 0, pool.width, pool.height)

    this.size = options.size || 100
    this.copy = (options.copy || "21ST.DEV") + " "
    this.color = options.color || "#cd96fe"
    this.delay = options.delay ?? 2
    this.basedelay = this.delay

    buffer.font = `${this.size}px Comic Sans MS`
    const metrics = buffer.measureText(this.copy)
    this.bound = { width: metrics.width, height: this.size * 1.5 }

    this.x = canvasWidth * 0.5 - this.bound.width * 0.5
    this.y = canvasHeight * (options.yFraction ?? 0.5) - this.bound.height * 0.5

    buffer.strokeStyle = this.color
    buffer.strokeText(this.copy, 0, this.bound.height * 0.8)
    this.data = buffer.getImageData(0, 0, this.bound.width, this.bound.height)
    this.index = 0
  }

  update(thunder: Thunder[], particles: Particles[]) {
    if (this.index >= this.bound.width) {
      // Fully revealed — stay fully drawn instead of looping back to blank.
      this.index = this.bound.width
      return
    }

    const data = this.data.data
    for (let i = this.index * 4; i < data.length; i += 4 * this.data.width) {
      const bitmap = data[i]! + data[i + 1]! + data[i + 2]! + data[i + 3]!
      if (bitmap > 255 && Math.random() > 0.94) {
        const x = this.x + this.index
        const y = this.y + i / this.bound.width / 4
        thunder.push(new Thunder({ x, y }))

        if (Math.random() > 0.3) {
          particles.push(new Particles({ x, y }))
        }
      }
    }

    if (this.delay-- < 0) {
      this.index += 2
      this.delay += this.basedelay
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.putImageData(this.data, this.x, this.y, 0, 0, this.index, this.bound.height)
  }
}

interface ThunderOptions {
  lifespan?: number
  color?: string
  glow?: string
  x?: number
  y?: number
  width?: number
  direct?: number
  max?: number
}

interface Segment {
  direct: number
  length: number
  change: number
}

class Thunder {
  lifespan: number
  maxlife: number
  color: string
  glow: string
  x: number
  y: number
  width: number
  direct: number
  max: number
  segments: Segment[]

  constructor(options: ThunderOptions = {}) {
    this.lifespan = options.lifespan || Math.round(Math.random() * 10 + 10)
    this.maxlife = this.lifespan
    this.color = options.color || "#fefefe"
    this.glow = options.glow || "#2323fe"
    this.x = options.x ?? Math.random() * window.innerWidth
    this.y = options.y ?? Math.random() * window.innerHeight
    this.width = options.width || 2
    this.direct = options.direct ?? Math.random() * Math.PI * 2
    this.max = options.max || Math.round(Math.random() * 10 + 20)
    this.segments = [...new Array(this.max)].map(() => ({
      direct: this.direct + (Math.PI * Math.random() * 0.2 - 0.1),
      length: Math.random() * 20 + 80,
      change: Math.random() * 0.04 - 0.02,
    }))
  }

  update(index: number, array: Thunder[]) {
    this.segments.forEach((s) => {
      s.direct += s.change
      if (Math.random() > 0.96) s.change *= -1
    })
    if (this.lifespan > 0) {
      this.lifespan--
    } else {
      this.remove(index, array)
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    if (this.lifespan <= 0) return

    ctx.beginPath()
    ctx.globalAlpha = this.lifespan / this.maxlife
    ctx.strokeStyle = this.color
    ctx.lineWidth = this.width
    ctx.shadowBlur = 32
    ctx.shadowColor = this.glow
    ctx.moveTo(this.x, this.y)

    let prev = { x: this.x, y: this.y }
    this.segments.forEach((s) => {
      const x = prev.x + Math.cos(s.direct) * s.length
      const y = prev.y + Math.sin(s.direct) * s.length
      prev = { x, y }
      ctx.lineTo(x, y)
    })

    ctx.stroke()
    ctx.closePath()
    ctx.shadowBlur = 0

    const strength = Math.random() * 80 + 40
    const light = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, strength)
    light.addColorStop(0, "rgba(250, 200, 50, 0.6)")
    light.addColorStop(0.1, "rgba(250, 200, 50, 0.2)")
    light.addColorStop(0.4, "rgba(250, 200, 50, 0.06)")
    light.addColorStop(0.65, "rgba(250, 200, 50, 0.01)")
    light.addColorStop(0.8, "rgba(250, 200, 50, 0)")

    ctx.beginPath()
    ctx.fillStyle = light
    ctx.arc(this.x, this.y, strength, 0, Math.PI * 2)
    ctx.fill()
    ctx.closePath()
  }

  remove(index: number, array: Thunder[]) {
    array.splice(index, 1)
  }
}

interface Vector {
  direct: number
  weight: number
  friction: number
}

interface Acceleration {
  change: number
  min: number
  max: number
}

interface Gravity {
  direct: number
  weight: number
}

interface SparkOptions {
  x?: number
  y?: number
  v?: Vector
  a?: Acceleration
  g?: Gravity
  width?: number
  lifespan?: number
  color?: string
}

class Spark {
  x: number
  y: number
  v: Vector
  a: Acceleration
  g: Gravity
  width: number
  lifespan: number
  maxlife: number
  color: string
  prev: { x: number; y: number }

  constructor(options: SparkOptions = {}) {
    this.x = options.x ?? window.innerWidth * 0.5
    this.y = options.y ?? window.innerHeight * 0.5
    this.v = options.v || {
      direct: Math.random() * Math.PI * 2,
      weight: Math.random() * 14 + 2,
      friction: 0.88,
    }
    this.a = options.a || {
      change: Math.random() * 0.4 - 0.2,
      min: this.v.direct - Math.PI * 0.4,
      max: this.v.direct + Math.PI * 0.4,
    }
    this.g = options.g || {
      direct: Math.PI * 0.5 + (Math.random() * 0.4 - 0.2),
      weight: Math.random() * 0.25 + 0.25,
    }
    this.width = options.width || Math.random() * 3
    this.lifespan = options.lifespan || Math.round(Math.random() * 20 + 40)
    this.maxlife = this.lifespan
    this.color = options.color || "#feca32"
    this.prev = { x: this.x, y: this.y }
  }

  update(index: number, array: Spark[]) {
    this.prev = { x: this.x, y: this.y }
    this.x += Math.cos(this.v.direct) * this.v.weight
    this.x += Math.cos(this.g.direct) * this.g.weight
    this.y += Math.sin(this.v.direct) * this.v.weight
    this.y += Math.sin(this.g.direct) * this.g.weight

    if (this.v.weight > 0.2) {
      this.v.weight *= this.v.friction
    }

    this.v.direct += this.a.change
    if (this.v.direct > this.a.max || this.v.direct < this.a.min) {
      this.a.change *= -1
    }

    if (this.lifespan > 0) {
      this.lifespan--
    } else {
      this.remove(index, array)
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    if (this.lifespan <= 0) return

    ctx.beginPath()
    ctx.globalAlpha = this.lifespan / this.maxlife
    ctx.strokeStyle = this.color
    ctx.lineWidth = this.width
    ctx.moveTo(this.x, this.y)
    ctx.lineTo(this.prev.x, this.prev.y)
    ctx.stroke()
    ctx.closePath()
  }

  remove(index: number, array: Spark[]) {
    array.splice(index, 1)
  }
}

interface ParticlesOptions extends SparkOptions {
  max?: number
}

class Particles {
  max: number
  sparks: Spark[]

  constructor(options: ParticlesOptions = {}) {
    this.max = options.max || Math.round(Math.random() * 10 + 10)
    this.sparks = [...new Array(this.max)].map(() => new Spark(options))
  }

  update() {
    this.sparks.forEach((s, i) => s.update(i, this.sparks))
  }

  render(ctx: CanvasRenderingContext2D) {
    this.sparks.forEach((s) => s.render(ctx))
  }
}

interface LightningTextProps {
  text?: string
  className?: string
  /** Vertical position of the text as a fraction of viewport height (0.5 = centered, lower = higher up). */
  yFraction?: number
  onCanvasClick?: (x: number, y: number) => void
}

export function LightningText({ text = "21ST.DEV", className, yFraction = 0.5, onCanvasClick }: LightningTextProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number | null>(null)
  const thunderRef = useRef<Thunder[]>([])
  const particlesRef = useRef<Particles[]>([])
  const textRef = useRef<Text | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const w = window.innerWidth
    const h = window.innerHeight

    canvas.width = w
    canvas.height = h

    textRef.current = new Text({ copy: text, yFraction }, w, h)

    const loop = () => {
      textRef.current!.update(thunderRef.current, particlesRef.current)
      thunderRef.current.forEach((l, i) => l.update(i, thunderRef.current))
      particlesRef.current.forEach((p) => p.update())

      ctx.globalCompositeOperation = "source-over"
      ctx.globalAlpha = 1
      ctx.fillStyle = "#000000"
      ctx.fillRect(0, 0, w, h)

      ctx.globalCompositeOperation = "screen"
      textRef.current!.render(ctx)
      thunderRef.current.forEach((l) => l.render(ctx))
      particlesRef.current.forEach((p) => p.render(ctx))

      animationRef.current = requestAnimationFrame(loop)
    }

    loop()

    const handleResize = () => {
      const newWidth = window.innerWidth
      const newHeight = window.innerHeight
      canvas.width = newWidth
      canvas.height = newHeight

      textRef.current = new Text({ copy: text, yFraction }, newWidth, newHeight)
    }

    window.addEventListener("resize", handleResize)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      window.removeEventListener("resize", handleResize)
    }
  }, [text, yFraction])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const x = e.clientX
    const y = e.clientY
    thunderRef.current.push(new Thunder({ x, y }))
    particlesRef.current.push(new Particles({ x, y }))
    onCanvasClick?.(x, y)
  }

  return (
    <div className={className ?? "relative w-full h-screen bg-black overflow-hidden"}>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="block w-full h-full cursor-crosshair"
      />
    </div>
  )
}
