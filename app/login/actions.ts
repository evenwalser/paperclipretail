'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'


export async function login(formData: FormData) {
    const supabase = await createClient()
  
    const email = (formData.get('email') as string).trim();
    const password = (formData.get('password') as string).trim();
  
    const data = { email, password };
  
    const { error } = await supabase.auth.signInWithPassword(data)
  
    if (error) {
      redirect('/login?tab=login&error=' + encodeURIComponent(error.message))
    }
    // return {success : true}
    revalidatePath('/', 'page')
    redirect('/')
  }


export async function signup(formData: FormData) {
    const supabase = await createClient()
  
  const name = (formData.get("name") as string).trim();
  const email = (formData.get("email") as string).trim();
  const password = (formData.get("password") as string).trim();
  const confirmPassword = (formData.get("confirmPassword") as string).trim();

    const role = "user";
  
    // Check if passwords match
    if (password !== confirmPassword) {
      redirect('/login?tab=signup&error=Passwords do not match')
    }
  
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    });
    if (error) {
      redirect('/login?tab=signup&error=' + encodeURIComponent(error.message))
    }

    const { error: userError } = await supabase
    .from("users")
    .insert({
      id: data.user?.id,
      name,
    });

  if (userError) {
    console.log(userError, "here is usererror");
    // Delete the user from auth since the record could not be created
    if (!data.user?.id) {
      throw new Error("User ID is missing; cannot delete user.");
    } else {
      await supabase.auth.admin.deleteUser(data.user.id);
    }
    
    // Check for a duplicate key (or similar) error to return a friendlier message.
    let errMsg = "Could not create user record";
    const lowerMsg = userError.message.toLowerCase();
    if (lowerMsg.includes("duplicate") || lowerMsg.includes("already exists")) {
      errMsg = "Email already exists";
    }
    return redirect("/login?tab=signup&error=" + encodeURIComponent(errMsg));
  }
  
  revalidatePath('/login', 'page');
  redirect('/login');
  }

export async function logout() {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
  
    if (error) {
      console.error("Error logging out:", error.message);
      return redirect("/error");
    }
  
    return redirect("/login");
  }