import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { ShieldCheck } from "lucide-react"
import { useLogin } from "@/lib/auth-api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const formSchema = z.object({
  password: z.string().min(1, "Password is required"),
})

type FormValues = z.infer<typeof formSchema>

export function LoginCard() {
  const login = useLogin()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "" },
  })

  function onSubmit(values: FormValues) {
    login.mutate(values, {
      onError: () => {
        form.setError("password", { message: "Incorrect password" })
      },
    })
  }

  return (
    <Card className="w-full max-w-sm border-primary/20 bg-background/90 shadow-2xl shadow-primary/10 backdrop-blur-md">
      <CardHeader className="items-center text-center pb-2">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight">SRS Controls</h1>
        <p className="text-sm text-muted-foreground">Enter the admin password to continue</p>
      </CardHeader>
      <CardContent className="pt-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      autoFocus
                      placeholder="Password"
                      className="h-11 text-center"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-center" />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full h-11" disabled={login.isPending}>
              {login.isPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
