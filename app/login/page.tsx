"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { login, signup } from "./actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { tab: "login" | "signup"; error?: string };
}) {
  const currentTab = searchParams.tab || "login";
  const isLogin = currentTab === "login";
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    if (isLogin) {
      await login(formData);
    } else {
      await signup(formData);
    }
    setLoading(false);
  }

  return (
    <div className="flex justify-center items-center h-[-webkit-fill-available] absolute w-full flex-col">
      <div className="p-6">
        <img
          src={"/paperclip_logo_red.png"}
          alt="Paperclip Logo"
          width={200}
          height={67}
          className="filter-none"
        />
      </div>
      <form
       key={isLogin ? 'login' : 'signup'}
        className="max-w-[600px] w-full p-6 rounded-xl border bg-card shadow" onSubmit={handleSubmit}
      >
        <div className="flex mb-6 flex items-center border border-[#ffffff] p-[5px]">
        <Link
            href="?tab=login"
            className={`py-[5px] px-[10px] text-lg font-medium transition-colors w-full text-center ${
              isLogin
                ? "p-[5px 10px] bg-[#ffffff] text-[#000000]"
                : "text-muted-foreground hover:text-primary"
            }`}
          >
            Login
          </Link>
          <Link
            href="?tab=signup"
            className={`py-[5px] px-[10px] text-lg font-medium transition-colors w-full text-center ${
              !isLogin
                ? " p-[5px 10px] bg-[#ffffff] text-[#000000]"
                : "text-muted-foreground hover:text-primary"
            }`}
          >
            Sign Up
          </Link>
        </div>

        {searchParams.error && (
          <div className="mb-4 text-red-500 text-sm">{searchParams.error}</div>
        )}

        {!isLogin && (
          <>
            <label className="mt-2 block" htmlFor="name">
              Name:
            </label>
            <Input id="name" name="name" type="text" required />
          </>
        )}

        <label className="mt-2 block" htmlFor="email">
          Email:
        </label>
        <Input id="email" name="email" type="email" required />

        <label className="mt-2 block" htmlFor="password">
          Password:
        </label>
        <Input id="password" name="password" type="password" required />

        {!isLogin && (
          <>
            <label className="mt-2 block" htmlFor="confirmPassword">
              Confirm Password:
            </label>
            <Input id="confirmPassword" name="confirmPassword" type="password" required />
          </>
        )}

        <Button
          type="submit"
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-9 flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg w-full mt-[20px]"
          disabled={loading}
        >
          {loading ? "Processing..." : isLogin ? "Log in" : "Sign up"}
        </Button>

        <div className="mt-4 text-center">
          <Link
            href="/reset-password"
            className="text-sm text-muted-foreground hover:text-primary text-[#0093ff]"
          >
            Forgot your password?
          </Link>
        </div>
      </form>
    </div>
  );
}


