import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Define public routes that do not require authentication
  const publicRoutes = ['/login', '/reset-password', '/update-password', '/accept-invite']
  
  // Define route permissions with their allowed roles
  const routePermissions = {
    '/': ['store_owner'], // Add home page restriction
    '/dashboard': ['store_owner'],
    '/inventory': ['sales_associate', 'store_owner'],
    '/inventory/edit/:id': ['store_owner'],
    '/inventory/add': ['store_owner'],
    '/pos': ['sales_associate', 'store_owner']  // Added POS route
    // Add more route-role mappings as needed
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get user role from the database
  let userRole = null
  if (user) {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    userRole = userData?.role
  }

  const pathname = request.nextUrl.pathname

  // Check if the route requires role-based access
  // Find the most specific matching route
  const matchingRoute = Object.entries(routePermissions)
    .filter(([route]) => pathname.startsWith(route))
    .sort((a, b) => b[0].length - a[0].length)[0]; // Sort by route length to get most specific match

  const requiredRoles = matchingRoute?.[1];

  if (requiredRoles) {
    // If route requires specific roles but user is not logged in
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // If user's role is not in the allowed roles
    if (!userRole || !requiredRoles.includes(userRole)) {
      // Special handling for sales_associate
      if (userRole === 'sales_associate') {
        // Redirect to inventory page from home page or inventory edit pages
        if (pathname === '/' || pathname.startsWith('/inventory/edit/')) {
          return NextResponse.redirect(new URL('/inventory', request.url))
        }
      }
      // For inventory/add, redirect to inventory page instead of unauthorized
      if (pathname.startsWith('/inventory/add')) {
        return NextResponse.redirect(new URL('/inventory', request.url))
      }
      return NextResponse.redirect(new URL('/inventory', request.url))
    }
  }
  
  // Handle non-role-protected routes
  if (
    !user &&
    !publicRoutes.some((route) => pathname.startsWith(route))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}