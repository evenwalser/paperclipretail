import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { resetPassword } from "./actions";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  return (
    <div className="flex justify-center items-center h-[-webkit-fill-available] absolute w-full">
      <form className="max-w-[600px] w-full p-6 rounded-xl border bg-card shadow">
        <h1 className="text-2xl font-bold mb-6 text-center">Reset Password</h1>

        {searchParams.error && (
          <div className="mb-4 text-red-500 text-sm">{searchParams.error}</div>
        )}

        {searchParams.success && (
          <div className="mb-4 text-green-500 text-sm">
            {searchParams.success}
          </div>
        )}

        <label className="mt-2 block" htmlFor="email">
          Email:
        </label>
        <Input id="email" name="email" type="email" required />

        <Button
          formAction={resetPassword}
          className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-9 flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg mt-[20px]"
        >
          Send Reset Link
        </Button>
      </form>
    </div>
  );
}