import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SUPER_ADMIN_EMAILS = ['adouflaws@gmail.com']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Routes publiques — bypass total
  if (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/portail') ||
    pathname.startsWith('/api/portail') ||
    pathname.startsWith('/tarifs') ||
    pathname.startsWith('/abonnement-expire') ||
    pathname.startsWith('/signature')
  ) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  const isSuperAdmin = !!user.email && SUPER_ADMIN_EMAILS.includes(user.email)

  // Routes admin — super_admin uniquement
  if (pathname.startsWith('/api/admin') || pathname.startsWith('/admin')) {
    if (!isSuperAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Super admin — bypass total du contrôle d'abonnement
  if (isSuperAdmin) return supabaseResponse

  // Contrôle d'abonnement pour les utilisateurs normaux
  const { data: profile } = await supabase
    .from('profiles')
    .select('entreprise_id')
    .eq('id', user.id)
    .single()

  if (profile?.entreprise_id) {
    const { data: entreprise } = await supabase
      .from('entreprises')
      .select('statut_abonnement, date_fin_abonnement')
      .eq('id', profile.entreprise_id)
      .single()

    if (entreprise) {
      // Compte suspendu → bloquer (pas de lecture seule)
      if (entreprise.statut_abonnement === 'suspendu') {
        const url = request.nextUrl.clone()
        url.pathname = '/abonnement-expire'
        return NextResponse.redirect(url)
      }

      // Compte expiré → mode lecture seule (laisse passer, le client gère via context)
      // Pas de redirect — SubscriptionBanner détecte l'expiration et active isReadOnly
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
