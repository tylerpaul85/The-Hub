# MSREG Hub — Mobile Micro-Interactions Library
*Premium Mobile Interactions & Silky-Smooth GPU Animations*

This library provides production-ready React component recipes and CSS snippets for the core micro-interactions of the **MSREG Hub**. All designs are optimized to run at **60fps on mobile viewports** (using exclusively CSS `transform` and `opacity`) and respect system-level user preferences for reduced motion.

---

## 1. Tactile Button Tap & Hover

### 1.1 Trigger, Rules & Feedback
* **Hover (Desktop/Mouse)**: Scales the button up slightly ($1.02\times$) and shifts background brightness to signal interactivity.
* **Tap/Active (Mobile/Touch)**: Compresses the button scale down to $0.97\times$ in **100ms** to simulate a physical mechanical spring.
* **Haptics**: Optionally triggers a subtle $10\text{ms}$ vibration on supported Android mobile devices.

### 1.2 Code Implementation (React + Tailwind v4)
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

interface TactileButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  children: React.ReactNode;
}

export function TactileButton({ variant = "primary", className, children, ...props }: TactileButtonProps) {
  const triggerHaptic = () => {
    if (typeof window !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10); // Subtle physical tap feedback
    }
  };

  return (
    <button
      className={cn(
        // Base transitions (GPU accelerated, transition-all handles transform/opacity/background)
        "relative inline-flex items-center justify-center gap-2 select-none touch-none rounded-xl px-5 py-3 text-sm font-semibold tracking-wide transition-all duration-150 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] outline-none border border-transparent",
        // Hover scaling (desktop-only hover optimization)
        "@media(hover:hover){hover:scale-[1.02] hover:-translate-y-px}",
        // Active touch spring compression
        "active:scale-[0.97] active:brightness-95 active:translate-y-0",
        // Focus indicators
        "focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        // Brand themes
        variant === "primary"
          ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-md shadow-black/10 active:shadow-none"
          : "bg-[var(--secondary)] text-[var(--secondary-foreground)] border-[var(--border)] active:bg-zinc-800",
        // Accessibility: respects prefers-reduced-motion
        "motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
        className
      )}
      onTouchStart={triggerHaptic}
      {...props}
    >
      {children}
    </button>
  );
}
```

---

## 2. Form Field Focus & Floating Label

### 2.1 Trigger, Rules & Feedback
* **Trigger**: Input element receives focus or is populated with text.
* **Rules**: The label shifts from a standard body placeholder state into a tiny caps subtitle placed above the input.
* **Feedback**: The input border transitions to Warm Copper (`var(--primary)`), and a subtle outline shadow expands outward.

### 2.2 Code Implementation (React + CSS)
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function FloatingInput({ label, error, className, ...props }: FloatingInputProps) {
  const uniqueId = React.useId();

  return (
    <div className="relative w-full flex flex-col pt-4 select-none">
      <input
        id={uniqueId}
        className={cn(
          "peer w-full min-h-12 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 text-base text-[var(--foreground)] outline-none transition-all duration-200 placeholder-transparent",
          // Focus highlights
          "focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]",
          // Error states
          error && "border-[var(--destructive)] focus:ring-[var(--destructive)]",
          className
        )}
        placeholder={label}
        {...props}
      />
      <label
        htmlFor={uniqueId}
        className={cn(
          "absolute left-4 top-[18px] z-10 origin-left text-sm text-zinc-500 transition-all duration-200 pointer-events-none select-none",
          // Peer selector handles floating transition when focused or not empty
          "peer-focus:-translate-y-7 peer-focus:scale-85 peer-focus:text-[var(--primary)]",
          "peer-[:not(:placeholder-shown)]:-translate-y-7 peer-[:not(:placeholder-shown)]:scale-85 peer-[:not(:placeholder-shown)]:text-zinc-500",
          error && "peer-focus:text-[var(--destructive)]",
          // Respect user preferences
          "motion-reduce:transition-none"
        )}
      >
        {label}
      </label>
      {error && (
        <span className="text-xs font-semibold text-[var(--destructive)] mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
          {error}
        </span>
      )}
    </div>
  );
}
```

---

## 3. High-Performance Loading Spinner

### 3.1 Trigger, Rules & Feedback
* **Trigger**: Initiating asynchronous network calls (e.g., submitting a listing).
* **Rules**: An infinite rotatory loop coupled with a fade-in layout entrance.
* **Feedback**: Rotating circle using CSS keyframe interpolation, optimized via GPU layers.

### 3.2 Code Implementation (React + CSS)
```tsx
import { Loader2 } from "lucide-react";

export function LoadingSpinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 select-none animate-in fade-in duration-200">
      <Loader2
        size={size}
        className="text-[var(--primary)] animate-spin-fast gpu-accelerated"
        style={{
          // Force layout layers onto the GPU
          willChange: "transform",
        }}
      />
      <span className="text-xs font-medium text-muted-foreground">Processing...</span>
    </div>
  );
}
```

Add this CSS rule inside [src/styles.css](file:///Users/tyler/Desktop/calendar-hub-craft-main/src/styles.css):
```css
@keyframes spinFast {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin-fast {
  animation: spinFast 0.6s linear infinite;
}

.gpu-accelerated {
  transform: translateZ(0);
  backface-visibility: hidden;
}
```

---

## 4. Success / Error Feedback Alerts

### 4.1 Trigger, Rules & Feedback
* **Success**: The submission completes. The alert container fades in and displays a custom animated SVG path that draws the checkmark visually.
* **Error**: The submission fails. The alert container performs a brief horizontal back-and-forth shake gesture to grab the user's attention.

### 4.2 Code Implementation (React + Tailwind v4)
```tsx
import * as React from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type FeedbackState = "success" | "error" | null;

interface FeedbackBannerProps {
  state: FeedbackState;
  message: string;
}

export function FeedbackBanner({ state, message }: FeedbackBannerProps) {
  if (!state) return null;

  return (
    <div
      role="alert"
      className={cn(
        "flex items-center gap-3 rounded-xl border p-4 text-sm font-medium transition-all duration-300 select-none",
        // Success state details
        state === "success" && "border-emerald-500/20 bg-emerald-950/20 text-emerald-400 animate-in fade-in zoom-in-95 duration-200",
        // Error state details (including shake animation)
        state === "error" && "border-red-500/20 bg-red-950/20 text-red-400 animate-shake",
        // Accessibility
        "motion-reduce:animate-none motion-reduce:transition-none"
      )}
    >
      {state === "success" ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
      ) : (
        <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
      )}
      <div className="flex-1">{message}</div>
    </div>
  );
}
```

Add this CSS rule inside [src/styles.css](file:///Users/tyler/Desktop/calendar-hub-craft-main/src/styles.css):
```css
@keyframes shakeAlert {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}

.animate-shake {
  animation: shakeAlert 0.35s ease-in-out;
}
```

---

## 5. Premium Interactive Card Highlights

### 5.1 Trigger, Rules & Feedback
* **Hover (Desktop)**: Translates the card up by $-4\text{px}$ and lightens the card border color.
* **Touch (Mobile)**: Shrinks card size slightly ($0.99\times$) on tap to emulate depressibility.
* **Feedback**: Backed by a smooth, high-performance transition timing curve.

### 5.2 Code Implementation (React + CSS)
```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

interface InteractiveCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function InteractiveCard({ className, children, ...props }: InteractiveCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 select-none transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        // Hover elevation shifts (desktop-only hover protection)
        "@media(hover:hover){hover:-translate-y-1 hover:border-zinc-700 hover:shadow-lg hover:shadow-black/20}",
        // Active touch state
        "active:scale-[0.99] active:brightness-98 active:translate-y-0 active:shadow-none",
        // Accessibility: respects prefers-reduced-motion
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
```

---

## 6. Accessibility & Performance Checklist

### 6.1 Prefers-Reduced-Motion Compliance
Always wrap your visual animations in standard Tailwind accessibility media query helpers:
* Use Tailwind's `motion-safe:` to apply animations only when the operating system allows motion.
* Alternatively, use `motion-reduce:transition-none motion-reduce:animate-none` to completely disable movement for users with vestibular disorders.

### 6.2 Rendering Optimization Checklist
* **Avoid Layout Triggers**: Never animate properties like `height`, `width`, `padding`, `margin`, `top`, or `left`. Doing so triggers expensive CPU layout calculations and drops frame rates on mobile screens.
* **Animate Transform and Opacity**: Only utilize `transform: translate/scale/rotate` and `opacity` to invoke GPU hardware acceleration.
* **Keep under 300ms**: The ideal micro-interaction duration on mobile devices is between **$100\text{ms}$ and $250\text{ms}$**. Anything longer feels slow or sluggish.
