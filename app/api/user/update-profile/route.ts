import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { walletAddress, userType } = body;

    // Validate wallet address format (Stellar public keys start with G and are 56 chars)
    if (walletAddress && !/^G[A-Z0-9]{55}$/.test(walletAddress)) {
      return NextResponse.json(
        { error: "Invalid wallet address format" },
        { status: 400 },
      );
    }

    // Validate userType
    if (userType && !["landlord", "tenant"].includes(userType)) {
      return NextResponse.json({ error: "Invalid user type" }, { status: 400 });
    }

    // Update user using Better Auth's updateUser API
    const updatedUser = await auth.api.updateUser({
      body: {
        ...(walletAddress && { walletAddress }),
        ...(userType && { userType }),
      },
      headers: await headers(),
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 },
    );
  }
}
