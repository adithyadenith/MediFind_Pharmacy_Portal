import { useState } from "react";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Activity, Building2, Database, KeyRound, Lock, Mail, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { resolveApiUrl } from "@/lib/api-client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const signInSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

const signUpSchema = z.object({
  pharmacyName: z.string().min(2, { message: "Pharmacy name must be at least 2 characters." }),
  address: z.string().min(5, { message: "Please enter a valid address." }),
  contactNumber: z
    .string()
    .min(7, { message: "Enter a valid contact number." })
    .regex(/^[0-9+\-\s()]+$/, { message: "Only digits, spaces, +, -, and () are allowed." }),
  databaseUrl: z.union([
    z.literal(""),
    z.string().url({ message: "Enter a valid database URL." }),
  ]),
  pharmacyEmail: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  confirmPassword: z.string().min(8, { message: "Confirm password is required." }),
}).refine((values) => values.password === values.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

const otpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, { message: "OTP must be 6 characters." }),
});

const forgotPasswordEmailSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
});

const forgotPasswordResetSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, { message: "OTP must be 6 characters." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  confirmPassword: z.string().min(8, { message: "Confirm password is required." }),
}).refine((values) => values.password === values.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

type SignInValues = z.infer<typeof signInSchema>;
type SignUpValues = z.infer<typeof signUpSchema>;
type OtpValues = z.infer<typeof otpSchema>;
type ForgotPasswordEmailValues = z.infer<typeof forgotPasswordEmailSchema>;
type ForgotPasswordResetValues = z.infer<typeof forgotPasswordResetSchema>;

function normalizeOtpInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

async function apiRequest<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(resolveApiUrl(url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || "Request failed");
  }

  return payload as T;
}

export default function Login() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [mode, setMode] = useState<"signin" | "signup-otp" | "forgot-email" | "forgot-reset">("signin");
  const [pendingEmail, setPendingEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const signInForm = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const signUpForm = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      pharmacyName: "",
      address: "",
      contactNumber: "",
      databaseUrl: "",
      pharmacyEmail: "",
      password: "",
      confirmPassword: "",
    },
  });

  const signUpOtpForm = useForm<OtpValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { email: "", otp: "" },
  });

  const forgotEmailForm = useForm<ForgotPasswordEmailValues>({
    resolver: zodResolver(forgotPasswordEmailSchema),
    defaultValues: { email: "" },
  });

  const forgotResetForm = useForm<ForgotPasswordResetValues>({
    resolver: zodResolver(forgotPasswordResetSchema),
    defaultValues: { email: "", otp: "", password: "", confirmPassword: "" },
  });

  const inputClass = "bg-background/50 border-white/10 focus-visible:ring-primary/50";

  async function onSignInSubmit(values: SignInValues) {
    setSubmitting(true);
    try {
      await apiRequest("/api/auth/login", values);
      toast.success("Logged in successfully");
      setLocation("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to log in");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSignUpSubmit(values: SignUpValues) {
    setSubmitting(true);
    try {
      const response = await apiRequest<{ message: string }>("/api/auth/register/send-otp", {
        pharmacyName: values.pharmacyName,
        address: values.address,
        contactNumber: values.contactNumber,
        databaseUrl: values.databaseUrl || undefined,
        email: values.pharmacyEmail,
        password: values.password,
        confirmPassword: values.confirmPassword,
      });

      setPendingEmail(values.pharmacyEmail);
      signUpOtpForm.setValue("email", values.pharmacyEmail);
      setMode("signup-otp");
      toast.success(response.message || "Verification code sent");
    } catch (error: any) {
      toast.error(error.message || "Failed to register pharmacy");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSignUpOtpSubmit(values: OtpValues) {
    setSubmitting(true);
    try {
      const response = await apiRequest<{ message?: string }>("/api/auth/register/verify-otp", values);
      toast.success(response.message || "Email verified. Your registration is pending admin approval.");
      signInForm.setValue("email", values.email);
      signInForm.setValue("password", "");
      signUpOtpForm.reset({ email: values.email, otp: "" });
      setMode("signin");
      setTab("signin");
    } catch (error: any) {
      toast.error(error.message || "Invalid OTP");
    } finally {
      setSubmitting(false);
    }
  }

  async function onForgotEmailSubmit(values: ForgotPasswordEmailValues) {
    setSubmitting(true);
    try {
      const response = await apiRequest<{ message: string }>("/api/auth/forgot-password/send-otp", values);
      setPendingEmail(values.email);
      forgotResetForm.setValue("email", values.email);
      setMode("forgot-reset");
      toast.success(response.message || "Password reset code sent");
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset code");
    } finally {
      setSubmitting(false);
    }
  }

  async function onForgotResetSubmit(values: ForgotPasswordResetValues) {
    setSubmitting(true);
    try {
      const response = await apiRequest<{ message: string }>("/api/auth/forgot-password/reset", values);
      toast.success(response.message || "Password updated successfully");
      forgotEmailForm.reset();
      forgotResetForm.reset({ email: "", otp: "", password: "", confirmPassword: "" });
      setMode("signin");
      setTab("signin");
    } catch (error: any) {
      toast.error(error.message || "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  }

  const signInView = (
    <Form {...signInForm}>
      <form onSubmit={signInForm.handleSubmit(onSignInSubmit)} className="space-y-4">
        <FormField
          control={signInForm.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground/80">Email</FormLabel>
              <FormControl>
                <Input placeholder="owner@medifind.com" className={inputClass} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={signInForm.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground/80">Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter your password" className={inputClass} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="text-right">
          <Button
            type="button"
            variant="link"
            className="px-0 text-xs text-muted-foreground hover:text-primary"
            onClick={() => {
              setMode("forgot-email");
              setPendingEmail("");
            }}
          >
            Forgot password?
          </Button>
        </div>
        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </Form>
  );

  const signUpView = (
    <Form {...signUpForm}>
      <form onSubmit={signUpForm.handleSubmit(onSignUpSubmit)} className="space-y-3">
        <FormField
          control={signUpForm.control}
          name="pharmacyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground/80 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" /> Pharmacy Name
              </FormLabel>
              <FormControl>
                <Input placeholder="MediFind Central Pharmacy" className={inputClass} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={signUpForm.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground/80 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" /> Address
              </FormLabel>
              <FormControl>
                <Input placeholder="123 Health Ave, Medical District" className={inputClass} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={signUpForm.control}
          name="contactNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground/80 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-primary" /> Contact Number
              </FormLabel>
              <FormControl>
                <Input placeholder="+94 77 123 4567" className={inputClass} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={signUpForm.control}
          name="pharmacyEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground/80 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-primary" /> Pharmacy Email
              </FormLabel>
              <FormControl>
                <Input placeholder="auth@medifindsdgp.com" className={inputClass} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={signUpForm.control}
          name="databaseUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground/80 flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-primary" /> Database URL
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="postgresql://user:password@host:5432/database"
                  className={inputClass}
                  {...field}
                />
              </FormControl>
              <p className="text-[11px] text-muted-foreground">
                Optional for now. It will be saved with the pharmacy registration when provided.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={signUpForm.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground/80 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-primary" /> Password
              </FormLabel>
              <FormControl>
                <Input type="password" placeholder="Create a password" className={inputClass} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={signUpForm.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground/80 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-primary" /> Confirm Password
              </FormLabel>
              <FormControl>
                <Input type="password" placeholder="Confirm your password" className={inputClass} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={submitting}>
          {submitting ? "Sending code..." : "Register Pharmacy"}
        </Button>
      </form>
    </Form>
  );

  const signUpOtpView = (
    <Form {...signUpOtpForm}>
      <form onSubmit={signUpOtpForm.handleSubmit(onSignUpOtpSubmit)} className="space-y-4">
        <div className="text-sm text-center mb-4 text-muted-foreground">
          Enter the verification code sent to <span className="font-medium text-foreground">{pendingEmail}</span>
        </div>
        <FormField
          control={signUpOtpForm.control}
          name="otp"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground/80">Verification Code</FormLabel>
              <FormControl>
                <Input
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="bg-background/50 border-white/10 text-center tracking-[0.5em] text-lg focus-visible:ring-primary/50"
                  value={field.value ?? ""}
                  onChange={(event) => field.onChange(normalizeOtpInput(event.target.value))}
                  onPaste={(event) => {
                    event.preventDefault();
                    field.onChange(normalizeOtpInput(event.clipboardData.getData("text")));
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={submitting}>
          {submitting ? "Verifying..." : "Verify Email"}
        </Button>
        <div className="text-center">
          <Button type="button" variant="link" className="text-xs text-muted-foreground hover:text-primary" onClick={() => setMode("signin")}>
            Back to sign in
          </Button>
        </div>
      </form>
    </Form>
  );

  const forgotEmailView = (
    <Form {...forgotEmailForm}>
      <form onSubmit={forgotEmailForm.handleSubmit(onForgotEmailSubmit)} className="space-y-4">
        <div className="text-sm text-center text-muted-foreground">
          Enter your pharmacy email address to receive a reset code.
        </div>
        <FormField
          control={forgotEmailForm.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground/80">Pharmacy Email</FormLabel>
              <FormControl>
                <Input placeholder="auth@medifindsdgp.com" className={inputClass} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={submitting}>
          {submitting ? "Sending code..." : "Send Reset OTP"}
        </Button>
        <div className="text-center">
          <Button type="button" variant="link" className="text-xs text-muted-foreground hover:text-primary" onClick={() => setMode("signin")}>
            Back to sign in
          </Button>
        </div>
      </form>
    </Form>
  );

  const forgotResetView = (
    <Form {...forgotResetForm}>
      <form onSubmit={forgotResetForm.handleSubmit(onForgotResetSubmit)} className="space-y-4">
        <div className="text-sm text-center text-muted-foreground">
          Enter the reset code sent to <span className="font-medium text-foreground">{pendingEmail}</span> and choose a new password.
        </div>
        <input type="hidden" {...forgotResetForm.register("email")} />
        <FormField
          control={forgotResetForm.control}
          name="otp"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground/80">Reset OTP</FormLabel>
              <FormControl>
                <Input
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="bg-background/50 border-white/10 text-center tracking-[0.5em] text-lg focus-visible:ring-primary/50"
                  value={field.value ?? ""}
                  onChange={(event) => field.onChange(normalizeOtpInput(event.target.value))}
                  onPaste={(event) => {
                    event.preventDefault();
                    field.onChange(normalizeOtpInput(event.clipboardData.getData("text")));
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={forgotResetForm.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground/80">New Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter a new password" className={inputClass} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={forgotResetForm.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground/80">Confirm Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Confirm your new password" className={inputClass} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={submitting}>
          {submitting ? "Updating..." : "Update Password"}
        </Button>
        <div className="text-center">
          <Button type="button" variant="link" className="text-xs text-muted-foreground hover:text-primary" onClick={() => setMode("signin")}>
            Back to sign in
          </Button>
        </div>
      </form>
    </Form>
  );

  const titleByMode = {
    signin: "Secure access with pharmacy email and password",
    "signup-otp": "Verify your pharmacy email",
    "forgot-email": "Reset your pharmacy password",
    "forgot-reset": "Choose a new password",
  } as const;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[100px] pointer-events-none" />

      <Card className="w-full max-w-md bg-card/50 backdrop-blur-xl border-white/10 shadow-2xl relative z-10">
        <CardHeader className="space-y-1 text-center pb-4">
          <div className="flex justify-center mb-3">
            <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
              <Activity className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Medifind Admin</CardTitle>
          <CardDescription className="text-muted-foreground">
            {titleByMode[mode]}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === "signin" ? (
            <Tabs value={tab} onValueChange={(value) => setTab(value as "signin" | "signup")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-5 bg-background/50 border border-white/10">
                <TabsTrigger value="signin" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                  Sign Up
                </TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                {signInView}
              </TabsContent>
              <TabsContent value="signup">
                {signUpView}
              </TabsContent>
            </Tabs>
          ) : mode === "signup-otp" ? signUpOtpView : mode === "forgot-email" ? forgotEmailView : forgotResetView}
        </CardContent>
      </Card>
    </div>
  );
}
