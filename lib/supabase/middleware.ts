import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSafePostUsernameRedirect, USERNAME_ONBOARDING_PATH } from "@/lib/profile-username";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/config";

const PUBLIC_PATHS = new Set(["/login", "/signup"]);

function copySessionHeaders(source: NextResponse, destination: NextResponse) {
  source.cookies.getAll().forEach((cookie) => destination.cookies.set(cookie));
  ["cache-control", "expires", "pragma"].forEach((header) => {
    const value = source.headers.get(header);
    if (value) destination.headers.set(header, value);
  });
  return destination;
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuthCallback = pathname.startsWith("/auth/");
  const isApiRoute = pathname.startsWith("/api/");
  const isUsernameOnboarding = pathname === USERNAME_ONBOARDING_PATH;
  const isPublicPage = PUBLIC_PATHS.has(pathname) || isAuthCallback;

  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === "development" || isPublicPage || isApiRoute) {
      return NextResponse.next({ request });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "?error=configuration";
    return NextResponse.redirect(loginUrl);
  }

  const { url, publishableKey } = getSupabaseConfig();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headersToSet).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !isPublicPage && !isApiRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return copySessionHeaders(response, NextResponse.redirect(loginUrl));
  }

  if (user && !isApiRoute && !isAuthCallback) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!profileError) {
      const hasUsername = typeof profile?.display_name === "string" && profile.display_name.trim().length > 0;
      if (!hasUsername && !isUsernameOnboarding) {
        const onboardingUrl = request.nextUrl.clone();
        onboardingUrl.pathname = USERNAME_ONBOARDING_PATH;
        onboardingUrl.search = "";
        const requestedNext = PUBLIC_PATHS.has(pathname)
          ? request.nextUrl.searchParams.get("next")
          : `${pathname}${request.nextUrl.search}`;
        onboardingUrl.searchParams.set("next", getSafePostUsernameRedirect(requestedNext));
        return copySessionHeaders(response, NextResponse.redirect(onboardingUrl));
      }

      if (hasUsername && isUsernameOnboarding) {
        const destinationUrl = request.nextUrl.clone();
        const next = getSafePostUsernameRedirect(request.nextUrl.searchParams.get("next"));
        const nextUrl = new URL(next, request.url);
        destinationUrl.pathname = nextUrl.pathname;
        destinationUrl.search = nextUrl.search;
        return copySessionHeaders(response, NextResponse.redirect(destinationUrl));
      }
    }
  }

  if (user && PUBLIC_PATHS.has(pathname)) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return copySessionHeaders(response, NextResponse.redirect(homeUrl));
  }

  return response;
}
