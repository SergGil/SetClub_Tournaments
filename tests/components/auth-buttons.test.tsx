// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignInButton } from "@/components/auth-buttons";

const { signInMock } = vi.hoisted(() => ({ signInMock: vi.fn(async () => undefined) }));
vi.mock("@/lib/auth", () => ({ signIn: signInMock }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SignInButton", () => {
  it("starts a Google sign-in redirecting to / by default", async () => {
    const user = userEvent.setup();
    render(<SignInButton />);
    await user.click(screen.getByRole("button", { name: "Увійти через Google" }));
    expect(signInMock).toHaveBeenCalledWith("google", { redirectTo: "/" });
  });

  it("redirects to the given callback URL after signing in", async () => {
    const user = userEvent.setup();
    render(<SignInButton callbackUrl="/tournaments/t1" />);
    await user.click(screen.getByRole("button", { name: "Увійти через Google" }));
    expect(signInMock).toHaveBeenCalledWith("google", { redirectTo: "/tournaments/t1" });
  });
});
