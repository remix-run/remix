export function validateEmail(email: unknown) {
  if (typeof email !== "string" || email.length < 3) {
    throw Error("Usernames must be at least 3 characters long");
  }

  // You can do real email validation here. This is just to keep it simple and
  // illustrate the point :)
  if (!email.includes("@")) {
    throw Error("Invalid email");
  }
  return email;
}

export function validatePassword(password: unknown) {
  if (typeof password !== "string" || password.length < 6) {
    throw Error("Passwords must be at least 6 characters long");
  }
  if (!/[!@.$^*()]/.test(password)) {
    throw Error("Passwords must contain at least 1 special character");
  }
  return password;
}
