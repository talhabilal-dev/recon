export const errors = {
  user: {
    badRequest: "Invalid request.",
    unauthorized: "Authentication required.",
    forbidden: "You do not have access to this resource.",
    notFound: "Resource not found.",
    internal: "Something went wrong.",
  },
  auth: {
    invalidInput: "Enter a valid email address and a password of at least 8 characters.",
    invalidCredentials: "Email or password is incorrect.",
    emailNotConfirmed: "Confirm your email address, then sign in.",
    emailInvalid: "That email address is not accepted.",
    emailTaken: "An account with that email already exists.",
    signUpFailed: "Could not create that account.",
    verifyFailed: "That confirmation link has expired or was already used.",
  },
  agent: {
    runFailed: "The agent failed to complete the request.",
    unsafeQuery: "The agent generated a query that is not allowed.",
    noTools: "The agent has no tools configured to answer this question.",
  },
  report: {
    notReady: "That PDF is still being generated.",
    failed: "That PDF could not be generated.",
  },
} as const;
