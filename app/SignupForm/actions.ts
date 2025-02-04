'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'




export async function signup(formData: FormData) {
    const supabase = await createClient()
  
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("password") as string;

    const role = "sales_associate";
  
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
      role,
      store_id: null
    });

  if (userError) {
    console.log(userError,"here is usererror");
    await supabase.auth.admin.deleteUser(data.user?.id!);
    return redirect("/login?tab=signup&error=Could not create user record");
  }
  // return {success : true}
  
    // revalidatePath('/login', 'page')
    redirect('/pos')
  }
