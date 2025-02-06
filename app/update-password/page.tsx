"use client"; // This page must be a client component
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if passwords match
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    // Check if password is strong enough (example: minimum length)
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    setErrorMessage("");
    setIsLoading(true);

    // Update password
    const { error } = await supabase.auth.updateUser({ password });

    setIsLoading(false);

    if (error) {
      alert("Error updating password: " + error.message);
      return;
    }

    alert("Password updated successfully!");
    router.push("/");
  };

  return (
    <div className="flex justify-center items-center h-[-webkit-fill-available] absolute w-full">
      <form
        onSubmit={handleUpdatePassword}
        className="max-w-[600px] w-full p-6 rounded-xl border bg-card shadow"
      >
        <h1 className="text-2xl font-bold mb-6 text-center">Update Password</h1>

        <label className="mt-2 block" htmlFor="password">
          New Password:
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <label className="mt-2 block" htmlFor="confirmPassword">
          Confirm Password:
        </label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        {errorMessage && (
          <p className="text-red-500 text-sm mt-2">{errorMessage}</p>
        )}

        <Button
          type="submit"
          className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-9 flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg mt-[20px]"
          disabled={isLoading}
        >
          {isLoading ? "Updating..." : "Update Password"}
        </Button>
      </form>
    </div>
  );
}
