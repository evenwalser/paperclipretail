"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { login, signup } from "./actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { tab: "login" | "signup"; error?: string };
}) {
  const currentTab = searchParams.tab || "login";
  const isLogin = currentTab === "login";
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

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

  const handleNoSpace = (e: React.FormEvent<HTMLInputElement>) => {
    const inputElement = e.target as HTMLInputElement;
    if (inputElement.value.includes(" ")) {
      inputElement.value = inputElement.value.replace(/\s+/g, "");
    }
  };

  async function handleGoogleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async function handleAppleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="flex justify-center items-center h-[-webkit-fill-available] absolute w-full flex-col">
      <div className="p-6">
        {/* <Image
          src={"/paperclip_logo_red.png"}
          alt="Paperclip Logo"
          width={200}
          height={67}
          className="filter-none"
        /> */}
      </div>
      <form
        key={isLogin ? "login" : "signup"}
        className="max-w-[600px] w-full p-6 rounded-xl border bg-card shadow"
        onSubmit={handleSubmit}
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
        <Input
          id="email"
          name="email"
          type="email"
          required
          onInput={handleNoSpace}
        />

        <label className="mt-2 block" htmlFor="password">
          Password:
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          onInput={handleNoSpace}
        />

        {!isLogin && (
          <>
            <label className="mt-2 block" htmlFor="confirmPassword">
              Confirm Password:
            </label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              onInput={handleNoSpace}
            />
          </>
        )}

        <Button
          type="submit"
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-9 flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg w-full mt-[20px]"
          disabled={loading}
        >
          {loading ? "Processing..." : isLogin ? "Log in" : "Sign up"}
        </Button>

        <div className="google-btn">
          <Button className="gsi-material-button" onClick={handleGoogleSignIn}>
            <div className="image-google">
              <svg
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                xmlnsXlink="http://www.w3.org/1999/xlink"
                style={{ display: "block" }}
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                ></path>
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                ></path>
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                ></path>
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                ></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
            </div>
            <span className="gsi-material-button-contents">
              Sign in with Google
            </span>
          </Button>
          <Button className="gsi-material-button" onClick={handleAppleSignIn}>
            <div className="image-google">
              <svg
                width="30"
                height="30"
                viewBox="0 0 22 24"
                fill="none"
                xmlns="[http://www.w3.org/2000/svg"
              >
                (http://www.w3.org/2000/svg%22%3E)
                <path
                  d="M15.499 0C14.2195 0.0885 12.724 0.9075 11.8525 1.974C11.0575 2.9415 10.4035 4.3785 10.6585 5.775C12.0565 5.8185 13.501 4.98 14.338 3.8955C15.121 2.886 15.7135 1.458 15.499 0Z"
                  fill="black"
                />
                <path
                  d="M20.5553 8.05192C19.3268 6.51143 17.6003 5.61743 15.9698 5.61743C13.8174 5.61743 12.9069 6.64793 11.4114 6.64793C9.86938 6.64793 8.69789 5.62043 6.8364 5.62043C5.00791 5.62043 3.06092 6.73792 1.82643 8.64891C0.0909416 11.3399 0.38794 16.3994 3.20042 20.7088C4.20692 22.2508 5.55091 23.9848 7.3089 23.9998C8.87339 24.0148 9.31439 22.9963 11.4339 22.9858C13.5534 22.9738 13.9554 24.0133 15.5169 23.9968C17.2763 23.9833 18.6938 22.0618 19.7003 20.5198C20.4218 19.4144 20.6903 18.8579 21.2498 17.6099C17.1803 16.0604 16.5278 10.2734 20.5553 8.05192Z"
                  fill="black"
                />
              </svg>
            </div>
            <span className="gsi-material-button-contents">
              Sign in with Apple
            </span>
          </Button>
        </div>

        <div className="mt-4 text-center">
          <Link
            href="/reset-password"
            className="text-sm text-muted-foreground hover:text-primary text-[#0093ff]"
          >
            Forgot your password?
          </Link>
        </div>
      </form>

      {/* OAuth Sign-In Buttons */}
      {/* <div className="mt-4 text-center max-w-[600px] w-full"> */}
        {/* <p className="text-sm text-muted-foreground">or</p> */}
        {/* <Button onClick={handleGoogleSignIn} className="mt-2 w-full">
          Sign in with Google
        </Button> */}

        {/* <Button onClick={handleAppleSignIn} className="mt-2 w-full">
          Sign in with Apple
        </Button> */}
      {/* </div> */}
    </div>
  );
}
