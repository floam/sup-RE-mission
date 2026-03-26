import { type NextRequest, NextResponse } from "next/server"

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
	"Access-Control-Max-Age": "86400",
}

export function middleware(request: NextRequest) {
	if (request.method === "OPTIONS") {
		return new NextResponse(null, { status: 204, headers: corsHeaders })
	}

	const response = NextResponse.next()
	for (const [key, value] of Object.entries(corsHeaders)) {
		response.headers.set(key, value)
	}
	return response
}

export const config = {
	matcher: [
		"/tokenlist",
		"/tokens/:path*",
		"/prices/:path*",
		"/points/:path*",
		"/openapi.json",
		"/superfluid.tokenlist.json",
		"/superfluid.extended.tokenlist.json",
		"/campaigns/:path*",
	],
}
