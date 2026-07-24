import { toast as sonnerToast } from "sonner"

export const useToast = () => {
  return {
    toast: ({ title, description, variant }: { title: React.ReactNode, description?: React.ReactNode, variant?: "default" | "destructive" }) => {
      if (variant === "destructive") {
        sonnerToast.error(title, { description })
      } else {
        sonnerToast.success(title, { description })
      }
    }
  }
}

export const toast = sonnerToast
