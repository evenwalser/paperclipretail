'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'


export async function login(formData: FormData) {
    const supabase = await createClient()
  
    const data = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    }
  
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
  
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("password") as string;

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
    console.log(userError,"here is usererror");
    await supabase.auth.admin.deleteUser(data.user?.id!);
    return redirect("/login?tab=signup&error=Could not create user record");
  }
  // return {success : true}
  
    revalidatePath('/login', 'page')
    redirect('/login')
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