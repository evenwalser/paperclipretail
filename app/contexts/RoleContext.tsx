// contexts/RoleContext.tsx
"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

interface RoleContextType {
  role: string | null;
  isLoading: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

interface RoleProviderProps {
  children: ReactNode;
}

export function RoleProvider({ children }: RoleProviderProps) {
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from("users")
            .select("role")
            .eq("id", user.id)
            .single();
          if (error) throw error;
          setRole(data.role);
        }
      } catch (error) {
        console.error("Error fetching role:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRole();
  }, []);

  return (
    <RoleContext.Provider value={{ role, isLoading }}>
      {children}
    </RoleContext.Provider>
  );
}

export const useRoleContext = (): RoleContextType => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRoleContext must be used within a RoleProvider");
  }
  return context;
};
