// Keep the original install URL usable alongside main's themed manifests.
export function GET(request: Request) {
  return Response.redirect(new URL("/pwa/manifest-light-blue-light.webmanifest", request.url), 307);
}
